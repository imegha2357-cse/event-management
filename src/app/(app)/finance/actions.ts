'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, denied, logActivity, zodFieldErrors, type ActionState } from '@/lib/session';
import { EXP_CATS } from '@/lib/catalog';
import { has } from '@/lib/plans';
import { inr, newId, todayIST } from '@/lib/util';

export async function addExpenseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const no = denied(ctx, 'payments'); if (no) return { error: no };
  const parsed = z.object({
    bookingId: z.string().min(1, 'Choose the event.'),
    category: z.enum(EXP_CATS as [string, ...string[]]),
    item: z.string().trim().min(2, 'Say what the expense was for.').max(200),
    amount: z.coerce.number({ error: 'Enter the amount.' }).int('Enter a whole rupee amount.').min(1, 'Enter the amount.').max(100000000),
    spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date.').refine(v => v <= todayIST(), 'The date cannot be in the future.'),
    paidTo: z.string().trim().max(120).optional().default(''),
    vendorId: z.string().optional().default(''),
    mode: z.enum(['Cash', 'UPI', 'Bank transfer']).optional().default('UPI'),
    bill: z.string().max(600000, 'The bill photo is too large.').refine(v => !v || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v), 'The bill photo could not be read.').optional().default(''),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues), error: 'Please correct the highlighted fields.' };
  const d = parsed.data;
  const { db, tenant } = ctx;
  const [b] = await db.select().from(schema.bookings).where(and(eq(schema.bookings.id, d.bookingId), eq(schema.bookings.tenantId, tenant.id))).limit(1);
  if (!b) return { fieldErrors: { bookingId: 'Choose the event.' } };
  let vendorId: string | null = null, paidTo = d.paidTo;
  if (d.vendorId && has(tenant, 'vendors')) {
    const [v] = await db.select().from(schema.vendors).where(and(eq(schema.vendors.id, d.vendorId), eq(schema.vendors.tenantId, tenant.id))).limit(1);
    if (v) { vendorId = v.id; paidTo = paidTo || v.name; }
  }
  await db.insert(schema.expenses).values({ id: newId(), tenantId: tenant.id, bookingId: b.id, category: d.category, item: d.item, amount: d.amount, spentOn: d.spentOn, paidTo, vendorId, mode: d.mode, bill: d.bill });
  await logActivity(ctx, `Added expense ${inr(d.amount)} (${d.category}) for ${b.title}`);
  revalidatePath('/finance'); revalidatePath(`/bookings/${b.id}`); revalidatePath('/finance/profit');
  return { ok: true, message: `Expense of ${inr(d.amount)} saved for ${b.title}.` };
}

export async function deleteExpenseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const no = denied(ctx, 'reports'); if (no) return { error: no };
  const id = String(fd.get('rid') ?? '');
  const [x] = await ctx.db.delete(schema.expenses).where(and(eq(schema.expenses.id, id), eq(schema.expenses.tenantId, ctx.tenant.id))).returning();
  if (!x) return { error: 'Expense not found.' };
  if (x.source === 'staff') await ctx.db.update(schema.staffPayments).set({ expenseId: null }).where(eq(schema.staffPayments.expenseId, x.id));
  await logActivity(ctx, `Deleted expense ${inr(x.amount)} (${x.item})`);
  revalidatePath('/finance/profit');
  return { ok: true };
}
