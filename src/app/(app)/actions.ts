'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, zodFieldErrors, type ActionState } from '@/lib/session';
import { newId, quoteTotals, randomToken, todayIST, quoteNo } from '@/lib/util';
import { decideQuotation, isUniqueViolation, logQuoteEvent, nextNumber, OPEN_STATUSES } from '@/lib/quotes';
import { deliverNotification, MAX_ATTEMPTS } from '@/lib/whatsapp';

const phone = z.string().trim().regex(/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, 'Enter a 10-digit Indian mobile number.');
const optText = (max: number) => z.string().trim().max(max).optional().default('');

/* ---------------- Customers ---------------- */
const customerSchema = z.object({
  name: z.string().trim().min(2, 'Enter the customer name.').max(100),
  phone,
  email: z.string().trim().toLowerCase().max(120).refine(v => !v || z.string().email().safeParse(v).success, 'Enter a valid email address.').optional().default(''),
  city: optText(60),
});

export async function createCustomerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant } = await requireUser();
  const parsed = customerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
  const id = newId();
  await db.insert(schema.customers).values({ id, tenantId: tenant.id, ...parsed.data, phone: parsed.data.phone.replace(/[\s-]/g, '') });
  revalidatePath('/customers');
  const back = String(fd.get('returnTo') ?? '');
  if (back === 'quote') redirect(`/quotations/new?customer=${id}`);
  redirect(`/customers/${id}`);
}

export async function updateCustomerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant } = await requireUser();
  const id = String(fd.get('rid') ?? '');
  const parsed = customerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
  const rows = await db.update(schema.customers).set({ ...parsed.data, phone: parsed.data.phone.replace(/[\s-]/g, '') })
    .where(and(eq(schema.customers.id, id), eq(schema.customers.tenantId, tenant.id))).returning({ id: schema.customers.id });
  if (!rows.length) return { error: 'Customer not found.' };
  revalidatePath(`/customers/${id}`);
  return { ok: true, message: 'Customer details saved.' };
}

/* ---------------- Quotations ---------------- */
const itemSchema = z.object({
  desc: z.string().trim().min(1, 'Describe each item.').max(200),
  qty: z.coerce.number().positive('Quantity must be more than 0.').max(100000),
  rate: z.coerce.number().min(0, 'Rate cannot be negative.').max(100000000),
});
const quoteSchema = z.object({
  customerId: z.string().min(1, 'Choose a customer.'),
  eventType: z.string().trim().min(2, 'Choose the event type.').max(60),
  eventTitle: z.string().trim().min(2, 'Enter an event title.').max(120),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the event date.'),
  startTime: z.string().regex(/^$|^\d{2}:\d{2}$/).optional().default(''),
  endTime: z.string().regex(/^$|^\d{2}:\d{2}$/).optional().default(''),
  venue: z.string().trim().min(2, 'Enter the venue.').max(200),
  guests: z.coerce.number().int('Guests must be a whole number.').min(0).max(100000),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid-until date.'),
  discount: z.coerce.number().min(0, 'Discount cannot be negative.').max(100000000),
  notes: optText(1000),
  items: z.array(itemSchema).min(1, 'Add at least one item.').max(60),
}).refine(v => v.eventDate >= todayIST(), { path: ['eventDate'], message: 'The event date cannot be in the past.' })
  .refine(v => v.validUntil >= todayIST(), { path: ['validUntil'], message: 'Valid-until cannot be in the past.' })
  .refine(v => !v.startTime || !v.endTime || v.endTime > v.startTime, { path: ['endTime'], message: 'End time must be after start time.' });

export async function saveQuotationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant, user } = await requireUser();
  let items: unknown = [];
  try { items = JSON.parse(String(fd.get('items') ?? '[]')); } catch { return { error: 'The item list could not be read. Please reload the page.' }; }
  const parsed = quoteSchema.safeParse({ ...Object.fromEntries(fd), items });
  if (!parsed.success) {
    const fe = zodFieldErrors(parsed.error.issues);
    return { fieldErrors: fe, error: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  const [cust] = await db.select({ id: schema.customers.id }).from(schema.customers).where(and(eq(schema.customers.id, d.customerId), eq(schema.customers.tenantId, tenant.id))).limit(1);
  if (!cust) return { fieldErrors: { customerId: 'Choose a customer.' } };
  const lineItems = d.items.map(i => ({ desc: i.desc, qty: i.qty, rate: Math.round(i.rate) }));
  const t = quoteTotals(lineItems, d.discount);
  const values = { customerId: d.customerId, eventType: d.eventType, eventTitle: d.eventTitle, eventDate: d.eventDate, startTime: d.startTime, endTime: d.endTime,
    venue: d.venue, guests: d.guests, notes: d.notes, items: lineItems, discount: t.discount, subtotal: t.subtotal, total: t.total, validUntil: d.validUntil };

  const id = String(fd.get('rid') ?? '');
  if (id) {
    const rows = await db.update(schema.quotations).set(values)
      .where(and(eq(schema.quotations.id, id), eq(schema.quotations.tenantId, tenant.id), inArray(schema.quotations.status, OPEN_STATUSES))).returning({ id: schema.quotations.id });
    if (!rows.length) return { error: 'This quotation can no longer be edited because it was already accepted or declined.' };
    await logQuoteEvent(tenant.id, id, 'edited', user.name);
    revalidatePath(`/quotations/${id}`);
    redirect(`/quotations/${id}`);
  }
  const newQuoteId = newId();
  for (let attempt = 0; ; attempt++) {
    const number = await nextNumber(schema.quotations, tenant.id);
    try {
      await db.insert(schema.quotations).values({ id: newQuoteId, tenantId: tenant.id, number, status: 'Draft', publicToken: randomToken(24), ...values });
      break;
    } catch (e) {
      if (!isUniqueViolation(e) || attempt >= 3) throw e;
    }
  }
  await logQuoteEvent(tenant.id, newQuoteId, 'created', user.name);
  revalidatePath('/quotations');
  redirect(`/quotations/${newQuoteId}?created=1`);
}

/** Marks a draft as sent. The customer can then open the review link to accept or decline. */
export async function markSentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant, user } = await requireUser();
  const id = String(fd.get('rid') ?? '');
  const rows = await db.update(schema.quotations).set({ status: 'Sent' })
    .where(and(eq(schema.quotations.id, id), eq(schema.quotations.tenantId, tenant.id), eq(schema.quotations.status, 'Draft'))).returning();
  if (!rows.length) return { error: 'Only draft quotations can be marked as sent.' };
  await logQuoteEvent(tenant.id, id, 'sent', user.name, String(fd.get('via') ?? ''));
  revalidatePath(`/quotations/${id}`);
  return { ok: true, message: `${quoteNo(rows[0].number)} is marked as sent. Your customer can now accept or decline it from the review link.` };
}

/** Accept or decline from inside the app (for example when the customer confirms by phone). */
export async function decideAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { tenant, user } = await requireUser();
  const id = String(fd.get('rid') ?? '');
  const decision = fd.get('decision') === 'Accepted' ? 'Accepted' : 'Declined';
  const reason = String(fd.get('reason') ?? '').trim();
  const r = await decideQuotation({ quotationId: id, tenantId: tenant.id, decision, actor: `${user.name} (on behalf of customer)`, reason });
  revalidatePath(`/quotations/${id}`); revalidatePath('/bookings'); revalidatePath('/dashboard');
  if (!r.ok) return { error: r.error };
  if (r.status === 'Declined') return { ok: true, message: 'The quotation was marked as declined. No booking was created.' };
  redirect(`/bookings/${r.bookingId}?new=1`);
}

/* ---------------- Bookings ---------------- */
export async function bookingStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant } = await requireUser();
  const id = String(fd.get('rid') ?? '');
  const status = String(fd.get('status') ?? '');
  if (!['Confirmed', 'Completed', 'Cancelled'].includes(status)) return { error: 'Unknown status.' };
  const rows = await db.update(schema.bookings).set({ status }).where(and(eq(schema.bookings.id, id), eq(schema.bookings.tenantId, tenant.id))).returning({ id: schema.bookings.id });
  if (!rows.length) return { error: 'Booking not found.' };
  revalidatePath(`/bookings/${id}`); revalidatePath('/bookings');
  return { ok: true, message: `Booking marked as ${status.toLowerCase()}.` };
}

export async function crewNeededAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant } = await requireUser();
  const id = String(fd.get('rid') ?? '');
  const n = z.coerce.number().int().min(0).max(500).safeParse(fd.get('crewNeeded'));
  if (!n.success) return { fieldErrors: { crewNeeded: 'Enter a number between 0 and 500.' } };
  await db.update(schema.bookings).set({ crewNeeded: n.data }).where(and(eq(schema.bookings.id, id), eq(schema.bookings.tenantId, tenant.id)));
  revalidatePath(`/bookings/${id}`);
  return { ok: true, message: 'Crew requirement saved.' };
}

export async function retryNotificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant } = await requireUser();
  const id = String(fd.get('rid') ?? '');
  const [n] = await db.select().from(schema.notifications).where(and(eq(schema.notifications.id, id), eq(schema.notifications.tenantId, tenant.id))).limit(1);
  if (!n) return { error: 'Message not found.' };
  if (n.status === 'sent') return { ok: true, message: 'This message was already delivered.' };
  const r = await deliverNotification(id);
  if (n.bookingId) {
    const [b] = await db.select({ q: schema.bookings.quotationId }).from(schema.bookings).where(eq(schema.bookings.id, n.bookingId)).limit(1);
    if (b?.q) await logQuoteEvent(tenant.id, b.q, r?.status === 'sent' ? 'whatsapp_sent' : 'whatsapp_failed', 'System', r?.status === 'sent' ? 'Booking confirmation sent on WhatsApp (retry)' : (r?.lastError ?? ''));
    revalidatePath(`/bookings/${n.bookingId}`);
  }
  revalidatePath('/settings');
  if (r?.status === 'sent') return { ok: true, message: 'WhatsApp message sent.' };
  return { error: `Still failing (attempt ${r?.attempts ?? '?'}): ${r?.lastError ?? 'unknown error'}` + ((r?.attempts ?? 0) >= MAX_ATTEMPTS ? ' Automatic retries have stopped; you can still retry here.' : '') };
}

/** Changes the phone number of a failed message (e.g. a typo) and sends it again. */
export async function fixPhoneAndRetryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant } = await requireUser();
  const id = String(fd.get('rid') ?? '');
  const p = phone.safeParse(fd.get('phone'));
  if (!p.success) return { fieldErrors: { phone: p.error.issues[0].message } };
  const digits = p.data.replace(/\D/g, '');
  const to = digits.length === 10 ? '91' + digits : digits;
  const rows = await db.update(schema.notifications).set({ toPhone: to, updatedAt: new Date() })
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.tenantId, tenant.id), inArray(schema.notifications.status, ['failed', 'queued']))).returning();
  if (!rows.length) return { error: 'Only failed messages can be changed.' };
  return retryNotificationAction(undefined, fd);
}

/* ---------------- Staff & crews ---------------- */
const employeeSchema = z.object({
  kind: z.enum(['permanent', 'helper']),
  name: z.string().trim().min(2, 'Enter the full name.').max(80),
  phone,
  dailyWage: z.coerce.number({ error: 'Enter the daily wage.' }).int('Enter a whole rupee amount.').min(1, 'Enter the daily wage.').max(100000),
  leaderId: z.string().optional().default(''),
}).refine(v => v.kind === 'permanent' || v.leaderId, { path: ['leaderId'], message: 'Choose the permanent employee who brought this helper.' });

export async function addEmployeeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant } = await requireUser();
  const parsed = employeeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
  const d = parsed.data;
  if (d.kind === 'helper') {
    const [leader] = await db.select().from(schema.staff).where(and(eq(schema.staff.id, d.leaderId), eq(schema.staff.tenantId, tenant.id), eq(schema.staff.kind, 'permanent'))).limit(1);
    if (!leader) return { fieldErrors: { leaderId: 'Choose the permanent employee who brought this helper.' } };
  }
  await db.insert(schema.staff).values({ id: newId(), tenantId: tenant.id, name: d.name, phone: d.phone.replace(/[\s-]/g, ''), kind: d.kind, leaderId: d.kind === 'helper' ? d.leaderId : null, dailyWage: d.dailyWage });
  revalidatePath('/staff');
  return { ok: true, message: `${d.name} was added as a ${d.kind === 'helper' ? 'helper boy' : 'permanent employee'}.` };
}

/** Assigns staff to a booking. Assigning a team leader also brings their helper boys. */
export async function assignCrewAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant } = await requireUser();
  const bookingId = String(fd.get('bookingId') ?? '');
  const staffId = String(fd.get('staffId') ?? '');
  const withTeam = fd.get('withTeam') === 'on';
  if (!staffId) return { fieldErrors: { staffId: 'Choose a person to assign.' } };
  const [b] = await db.select().from(schema.bookings).where(and(eq(schema.bookings.id, bookingId), eq(schema.bookings.tenantId, tenant.id))).limit(1);
  if (!b) return { error: 'Booking not found.' };
  if (b.status === 'Cancelled') return { error: 'This booking is cancelled.' };
  const all = await db.select().from(schema.staff).where(eq(schema.staff.tenantId, tenant.id));
  const person = all.find(s => s.id === staffId);
  if (!person) return { fieldErrors: { staffId: 'Choose a person to assign.' } };
  const people = [person, ...(withTeam && person.kind === 'permanent' ? all.filter(s => s.leaderId === person.id) : [])];
  const rows = await db.insert(schema.bookingCrew).values(people.map(p => ({ id: newId(), tenantId: tenant.id, bookingId, staffId: p.id, wage: p.dailyWage })))
    .onConflictDoNothing().returning();
  revalidatePath(`/bookings/${bookingId}`); revalidatePath('/staff');
  if (!rows.length) return { error: 'Already assigned to this booking.' };
  return { ok: true, message: `Assigned ${rows.length} ${rows.length === 1 ? 'person' : 'people'}.` };
}

export async function removeCrewAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant } = await requireUser();
  const id = String(fd.get('rid') ?? '');
  const rows = await db.delete(schema.bookingCrew).where(and(eq(schema.bookingCrew.id, id), eq(schema.bookingCrew.tenantId, tenant.id))).returning();
  if (rows[0]) { revalidatePath(`/bookings/${rows[0].bookingId}`); revalidatePath('/staff'); }
  return rows.length ? { ok: true } : { error: 'Assignment not found.' };
}

export async function togglePresentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant } = await requireUser();
  const id = String(fd.get('rid') ?? '');
  const present = fd.get('present') === 'true';
  const rows = await db.update(schema.bookingCrew).set({ present }).where(and(eq(schema.bookingCrew.id, id), eq(schema.bookingCrew.tenantId, tenant.id))).returning();
  if (!rows.length) return { error: 'Assignment not found.' };
  revalidatePath(`/bookings/${rows[0].bookingId}`); revalidatePath('/staff');
  return { ok: true };
}

export async function recordStaffPaymentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant } = await requireUser();
  const parsed = z.object({
    staffId: z.string().min(1),
    amount: z.coerce.number({ error: 'Enter the amount.' }).int('Enter a whole rupee amount.').min(1, 'Enter an amount above ₹0.').max(10000000),
    paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the payment date.').refine(v => v <= todayIST(), 'The payment date cannot be in the future.'),
    note: optText(200),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
  const [s] = await db.select().from(schema.staff).where(and(eq(schema.staff.id, parsed.data.staffId), eq(schema.staff.tenantId, tenant.id))).limit(1);
  if (!s) return { error: 'Employee not found.' };
  await db.insert(schema.staffPayments).values({ id: newId(), tenantId: tenant.id, ...parsed.data });
  revalidatePath('/staff');
  return { ok: true, message: `Payment of ₹${parsed.data.amount.toLocaleString('en-IN')} to ${s.name} recorded.` };
}

/* ---------------- Settings ---------------- */
export async function updateCompanyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant } = await requireUser();
  const parsed = z.object({
    name: z.string().trim().min(2, 'Enter your company name.').max(120),
    phone: z.string().trim().regex(/^[0-9+\s-]{10,15}$/, 'Enter a valid phone number.'),
    city: z.string().trim().min(2, 'Enter your city.').max(60),
    address: optText(300),
    gstin: z.string().trim().toUpperCase().regex(/^$|^[0-9A-Z]{15}$/, 'GSTIN has 15 letters and numbers.').optional().default(''),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
  await db.update(schema.tenants).set(parsed.data).where(eq(schema.tenants.id, tenant.id));
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Company details saved.' };
}

