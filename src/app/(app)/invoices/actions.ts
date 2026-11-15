'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq, max } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, denied, logActivity, zodFieldErrors, type ActionState } from '@/lib/session';
import { perk } from '@/lib/plans';
import { docTotals, fy, PAY_KINDS, PAY_MODES } from '@/lib/catalog';
import { docCfg } from '@/lib/docs';
import { invoicePaid } from '@/lib/money';
import { insertInvoice, missingInvoiceBookings } from '@/lib/invoice';
import { isUniqueViolation } from '@/lib/quotes';
import { inr, newId, todayIST } from '@/lib/util';

const itemSchema = z.object({ desc: z.string().trim().min(1, 'Describe each item.').max(200), qty: z.coerce.number().positive('Quantity must be more than 0.').max(100000), rate: z.coerce.number().min(0).max(100000000) });

export async function createInvoiceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const no = denied(ctx, 'invoices'); if (no) return { error: no };
  const { db, tenant } = ctx;
  let items: unknown = [];
  try { items = JSON.parse(String(fd.get('items') ?? '[]')); } catch { return { error: 'The item list could not be read. Please reload the page.' }; }
  const parsed = z.object({
    bookingId: z.string().min(1),
    issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the invoice date.'),
    discount: z.coerce.number().min(0).max(100000000).optional().default(0),
    notes: z.string().trim().max(1000).optional().default(''),
    items: z.array(itemSchema).min(1, 'Add at least one item.').max(60),
  }).safeParse({ ...Object.fromEntries(fd), items });
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues), error: 'Please correct the highlighted fields.' };
  const d = parsed.data;
  const [b] = await db.select().from(schema.bookings).where(and(eq(schema.bookings.id, d.bookingId), eq(schema.bookings.tenantId, tenant.id))).limit(1);
  if (!b) return { error: 'Booking not found.' };
  const [existing] = await db.select().from(schema.invoices).where(eq(schema.invoices.bookingId, b.id)).limit(1);
  if (existing) redirect(`/invoices/${existing.id}`);
  const gst = Boolean(tenant.gstin) && fd.get('gst') === 'on';
  const lines = d.items.map(i => ({ desc: i.desc, qty: i.qty, rate: Math.round(i.rate) }));
  const { invoice } = await insertInvoice(tenant, b, { items: lines, discount: d.discount, gst, issuedOn: d.issuedOn, notes: d.notes });
  const t = { total: invoice.total };
  const id = invoice.id;
  if (b.status === 'Enquiry') await db.update(schema.bookings).set({ status: 'Confirmed' }).where(eq(schema.bookings.id, b.id));
  if (!b.total) await db.update(schema.bookings).set({ total: t.total, items: lines }).where(eq(schema.bookings.id, b.id));
  await logActivity(ctx, `Created invoice for “${b.title}” (${inr(t.total)})`);
  revalidatePath('/invoices'); revalidatePath(`/bookings/${b.id}`);
  redirect(`/invoices/${id}?created=1`);
}

const paySchema = z.object({
  invoiceId: z.string().min(1, 'Choose the event.'),
  kind: z.enum(PAY_KINDS as [string, ...string[]]).optional().default('Installment'),
  amount: z.coerce.number({ error: 'Enter the amount received.' }).int('Enter a whole rupee amount.').min(1, 'Enter the amount received.'),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date.').refine(v => v <= todayIST(), 'The date cannot be in the future.'),
  mode: z.enum(PAY_MODES as [string, ...string[]]).optional().default('UPI'),
  reference: z.string().trim().max(120).optional().default(''),
});

/** Records an advance, installment or final payment (Pro). */
export async function recordPaymentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const no = denied(ctx, 'payments') ?? denied(ctx, 'invoices'); if (no) return { error: no };
  if (!perk(ctx.tenant, 'paymentTracking')) return { error: 'Recording part payments comes with the Pro plan.' };
  const parsed = paySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues), error: 'Please correct the highlighted fields.' };
  const d = parsed.data;
  const { db, tenant } = ctx;
  const [inv] = await db.select().from(schema.invoices).where(and(eq(schema.invoices.id, d.invoiceId), eq(schema.invoices.tenantId, tenant.id))).limit(1);
  if (!inv) return { error: 'Invoice not found.' };
  const bal = inv.total - (await invoicePaid(ctx, inv.id));
  if (bal <= 0) return { error: 'This invoice is already fully paid.' };
  if (d.amount > bal) return { fieldErrors: { amount: `That is more than the balance of ${inr(bal)}.` } };
  await db.insert(schema.invoicePayments).values({ id: newId(), tenantId: tenant.id, invoiceId: inv.id, amount: d.amount, kind: d.kind, mode: d.mode, paidOn: d.paidOn, reference: d.reference });
  const [b] = inv.bookingId ? await db.select().from(schema.bookings).where(eq(schema.bookings.id, inv.bookingId)).limit(1) : [];
  if (b?.status === 'Enquiry') await db.update(schema.bookings).set({ status: 'Confirmed' }).where(eq(schema.bookings.id, b.id));
  await logActivity(ctx, `Recorded ${inr(d.amount)} (${d.kind}, ${d.mode}) for ${b?.title ?? inv.docNo}`);
  revalidatePath('/finance'); revalidatePath(`/invoices/${inv.id}`); if (b) revalidatePath(`/bookings/${b.id}`); revalidatePath('/dashboard');
  const [c] = await db.select().from(schema.customers).where(eq(schema.customers.id, inv.customerId)).limit(1);
  const newBal = bal - d.amount;
  return { ok: true, message: `${inr(d.amount)} recorded. Balance now ${inr(newBal)}.`,
    data: perk(tenant, 'whatsappShare') && c?.phone ? { phone: c.phone, receipt: `Vanakkam ${c.name}, we have received ${inr(d.amount)} by ${d.mode} on ${d.paidOn.split('-').reverse().join('-')} for ${b?.title ?? 'your event'}${d.reference ? ` (ref: ${d.reference})` : ''}. Balance pending: ${inr(newBal)}. Thank you, ${tenant.name}.` } : undefined };
}

/** Basic plan: mark the whole remaining balance as paid in one go. */
export async function markPaidAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const no = denied(ctx, 'invoices'); if (no) return { error: no };
  const id = String(fd.get('rid') ?? '');
  const [inv] = await ctx.db.select().from(schema.invoices).where(and(eq(schema.invoices.id, id), eq(schema.invoices.tenantId, ctx.tenant.id))).limit(1);
  if (!inv) return { error: 'Invoice not found.' };
  const bal = inv.total - (await invoicePaid(ctx, inv.id));
  if (bal <= 0) return { ok: true, message: 'Already fully paid.' };
  await ctx.db.insert(schema.invoicePayments).values({ id: newId(), tenantId: ctx.tenant.id, invoiceId: inv.id, amount: bal, kind: 'Final payment', mode: 'Cash', paidOn: todayIST(), reference: 'Marked as fully paid' });
  await logActivity(ctx, `Marked invoice ${inv.docNo} as fully paid`);
  revalidatePath(`/invoices/${inv.id}`); revalidatePath('/invoices');
  return { ok: true, message: 'Marked as fully paid.' };
}

/** Raises invoices for accepted bookings that do not have one yet (e.g. accepted before automatic invoices). */
export async function generateMissingInvoicesAction(): Promise<ActionState> {
  const ctx = await requireUser();
  const no = denied(ctx, 'invoices'); if (no) return { error: no };
  const missing = await missingInvoiceBookings(ctx);
  let n = 0;
  for (const { b, q } of missing) { const r = await insertInvoice(ctx.tenant, b, { items: q.items, discount: q.discount, gst: q.gst }); if (r.created) n++; }
  if (n) await logActivity(ctx, `Generated ${n} invoice${n === 1 ? '' : 's'} for accepted bookings`);
  revalidatePath('/invoices'); revalidatePath('/bookings');
  return { ok: true, message: n ? `${n} invoice${n === 1 ? '' : 's'} created.` : 'Every accepted booking already has an invoice.' };
}
