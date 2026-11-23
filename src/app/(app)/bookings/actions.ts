'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, denied, logActivity, zodFieldErrors, type ActionState } from '@/lib/session';
import { LIMITS, isEnt } from '@/lib/plans';
import { BASE_STATUSES } from '@/lib/catalog';
import { activeEventCount } from '@/lib/money';
import { isUniqueViolation, nextNumber } from '@/lib/quotes';
import { newId, fmtDate } from '@/lib/util';

const phone = z.string().trim().regex(/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, 'Enter a 10-digit Indian mobile number.');
const time = z.string().regex(/^$|^\d{2}:\d{2}$/).optional().default('');

const bookingSchema = z.object({
  customerId: z.string().min(1, 'Choose a customer.'),
  title: z.string().trim().max(120).optional().default(''),
  eventType: z.string().trim().min(2, 'Choose the event type.').max(60),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the event date.'),
  setupTime: time, startTime: time, endTime: time,
  guests: z.coerce.number().int('Guests must be a whole number.').min(0).max(100000),
  venue: z.string().trim().max(200).optional().default(''),
  crewNeeded: z.coerce.number().int().min(0).max(500).optional().default(0),
  notes: z.string().trim().max(1000).optional().default(''),
  branchId: z.string().optional().default(''),
}).refine(v => !v.startTime || !v.endTime || v.endTime > v.startTime, { path: ['endTime'], message: 'End time must be after start time.' });

/** Reads Enterprise custom field values (inputs named cf_<id>). */
export async function readCustom(fd: FormData, fields: { id: string; label: string; type: string }[]) {
  const out: Record<string, string> = {};
  for (const f of fields) { const v = String(fd.get('cf_' + f.id) ?? '').trim().slice(0, 300); if (v) out[f.id] = v; }
  return out;
}

export async function saveBookingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const no = denied(ctx, 'events'); if (no) return { error: no };
  const { db, tenant } = ctx;
  const raw = Object.fromEntries(fd);
  const parsed = bookingSchema.safeParse(raw);
  const fe: Record<string, string> = parsed.success ? {} : zodFieldErrors(parsed.error.issues);
  let newCustomer: { name: string; phone: string } | null = null;
  if (raw.customerId === '__new') {
    const nc = z.object({ newName: z.string().trim().min(2, 'Enter the customer name.').max(100), newPhone: phone }).safeParse(raw);
    if (!nc.success) Object.assign(fe, zodFieldErrors(nc.error.issues)); else newCustomer = { name: nc.data.newName, phone: nc.data.newPhone.replace(/[\s-]/g, '') };
    delete fe.customerId;
  }
  if (!parsed.success || Object.keys(fe).length) return { fieldErrors: fe, error: 'Please correct the highlighted fields.' };
  const d = parsed.data;
  const lim = LIMITS[ctx.plan].events;
  if (lim !== Infinity && (await activeEventCount(ctx)) >= lim) return { error: `The Basic plan allows ${lim} active events at a time. Mark finished events as Completed, or ask for an upgrade in Settings → Plan.` };
  let customerId = d.customerId, customerName = '';
  if (newCustomer) {
    customerId = newId(); customerName = newCustomer.name;
    await db.insert(schema.customers).values({ id: customerId, tenantId: tenant.id, name: newCustomer.name, phone: newCustomer.phone, city: tenant.city });
  } else {
    const [c] = await db.select().from(schema.customers).where(and(eq(schema.customers.id, d.customerId), eq(schema.customers.tenantId, tenant.id))).limit(1);
    if (!c) return { fieldErrors: { customerId: 'Choose a customer.' } };
    customerName = c.name;
  }
  const services = fd.getAll('services').map(String).filter(k => ctx.services.some(s => s.key === k && s.on));
  const ent = isEnt(tenant);
  const branchId = ent && (ctx.custom.branches ?? []).some(b => b.id === d.branchId) ? d.branchId : null;
  const custom = ent ? await readCustom(fd, ctx.custom.eventFields ?? []) : {};
  const surname = customerName.replace(/\(.*\)/, '').trim().split(/\s+/).filter(w => !/^(and|&|family)$/i.test(w)).pop() || customerName;
  const title = d.title || `${surname} ${d.eventType.toLowerCase()}`;
  const id = newId();
  for (let attempt = 0; ; attempt++) {
    const number = await nextNumber(schema.bookings, tenant.id);
    try {
      await db.insert(schema.bookings).values({ id, tenantId: tenant.id, number, customerId, title, eventType: d.eventType, eventDate: d.eventDate, setupTime: d.setupTime, startTime: d.startTime,
        endTime: d.endTime, venue: d.venue, guests: d.guests, crewNeeded: d.crewNeeded, notes: d.notes, status: 'Confirmed', services, branchId, custom });
      break;
    } catch (e) { if (!isUniqueViolation(e) || attempt >= 3) throw e; }
  }
  await logActivity(ctx, `Confirmed booking “${title}” on ${fmtDate(d.eventDate)}`);
  revalidatePath('/bookings'); revalidatePath('/dashboard');
  redirect(`/bookings/${id}?saved=1`);
}

export async function setBookingStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const no = denied(ctx, 'events'); if (no) return { error: no };
  const id = String(fd.get('rid') ?? '');
  const status = String(fd.get('status') ?? '');
  const allowed = [...BASE_STATUSES, ...(isEnt(ctx.tenant) ? ctx.custom.statuses ?? [] : [])];
  if (!allowed.includes(status)) return { error: 'Unknown status.' };
  const rows = await ctx.db.update(schema.bookings).set({ status }).where(and(eq(schema.bookings.id, id), eq(schema.bookings.tenantId, ctx.tenant.id))).returning({ title: schema.bookings.title });
  if (!rows.length) return { error: 'Booking not found.' };
  await logActivity(ctx, `Changed “${rows[0].title}” to ${status}`);
  revalidatePath(`/bookings/${id}`); revalidatePath('/bookings'); revalidatePath('/dashboard');
  return { ok: true, message: `Marked as ${status}.` };
}

export async function deleteBookingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const no = denied(ctx, 'events'); if (no) return { error: no };
  const id = String(fd.get('rid') ?? '');
  const [b] = await ctx.db.select().from(schema.bookings).where(and(eq(schema.bookings.id, id), eq(schema.bookings.tenantId, ctx.tenant.id))).limit(1);
  if (!b) return { error: 'Booking not found.' };
  if (b.quotationId) return { error: 'This booking came from an accepted quotation. Mark it as Cancelled instead.' };
  const [inv] = await ctx.db.select({ id: schema.invoices.id }).from(schema.invoices).where(eq(schema.invoices.bookingId, id)).limit(1);
  if (inv) return { error: 'This booking has an invoice. Mark it as Cancelled instead.' };
  await ctx.db.delete(schema.bookings).where(eq(schema.bookings.id, id));
  await logActivity(ctx, `Deleted booking “${b.title}”`);
  revalidatePath('/bookings');
  redirect('/bookings');
}
