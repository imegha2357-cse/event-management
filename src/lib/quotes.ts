import 'server-only';
import { and, eq, inArray, isNull, max } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { newId, bookingNo } from '@/lib/util';
import { queueBookingConfirmation } from '@/lib/whatsapp';

export const OPEN_STATUSES = ['Draft', 'Sent'];

export async function logQuoteEvent(tenantId: string, quotationId: string, action: string, actor: string, note = '') {
  const db = await getDb();
  await db.insert(schema.quotationEvents).values({ id: newId(), tenantId, quotationId, action, actor, note });
}

/** Next running number for a company's quotations or bookings. */
export async function nextNumber(table: typeof schema.quotations | typeof schema.bookings, tenantId: string) {
  const db = await getDb();
  const [r] = await db.select({ m: max(table.number) }).from(table).where(eq(table.tenantId, tenantId));
  return (r?.m ?? 0) + 1;
}

/** True for Postgres "duplicate key" errors (code 23505), however the driver wraps them. */
export function isUniqueViolation(e: unknown): boolean {
  let cur: any = e;
  for (let i = 0; i < 4 && cur; i++) { if (cur.code === '23505') return true; cur = cur.cause; }
  return /duplicate key value/i.test(String((e as any)?.message ?? '')) || /duplicate key value/i.test(String((e as any)?.cause?.message ?? ''));
}

/**
 * Creates the booking for an accepted quotation. Safe to call more than once:
 * bookings.quotation_id is UNIQUE, so a second call finds the existing booking instead of making a duplicate.
 */
export async function ensureBookingForQuote(q: typeof schema.quotations.$inferSelect) {
  const db = await getDb();
  const [existing] = await db.select().from(schema.bookings).where(eq(schema.bookings.quotationId, q.id)).limit(1);
  if (existing) return { booking: existing, created: false };
  if (q.bookingId) {
    // The quotation was made for an existing enquiry: confirm that event instead of creating another one.
    const [linked] = await db.update(schema.bookings).set({
      quotationId: q.id, status: 'Confirmed', items: q.items, total: q.total, title: q.eventTitle, eventType: q.eventType, eventDate: q.eventDate,
      startTime: q.startTime, endTime: q.endTime, venue: q.venue, guests: q.guests,
    }).where(and(eq(schema.bookings.id, q.bookingId), eq(schema.bookings.tenantId, q.tenantId), isNull(schema.bookings.quotationId))).returning();
    if (linked) return { booking: linked, created: true };
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const number = await nextNumber(schema.bookings, q.tenantId);
    try {
      const rows = await db.insert(schema.bookings).values({
        id: newId(), tenantId: q.tenantId, number, quotationId: q.id, customerId: q.customerId, title: q.eventTitle, eventType: q.eventType,
        eventDate: q.eventDate, startTime: q.startTime, endTime: q.endTime, venue: q.venue, guests: q.guests, items: q.items, total: q.total,
        notes: q.notes, crewNeeded: Math.max(0, Math.ceil(q.guests / 8)), status: 'Confirmed',
      }).onConflictDoNothing({ target: schema.bookings.quotationId }).returning();
      if (rows.length) return { booking: rows[0], created: true };
      const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.quotationId, q.id)).limit(1);
      if (b) return { booking: b, created: false };
    } catch (e) {
      // Another booking took the same running number at the same moment: try the next number.
      if (!isUniqueViolation(e)) throw e;
    }
  }
  throw new Error('Could not create the booking. Please try again.');
}

export type DecisionResult =
  | { ok: true; status: 'Accepted' | 'Declined'; bookingId?: string; bookingCreated?: boolean; notification?: { status: string; lastError: string | null } }
  | { ok: false; error: string; status?: string; bookingId?: string };

/**
 * Accepts or declines a quotation. The status changes only if the quotation is still open,
 * using one conditional UPDATE, so a double click or two people deciding at once cannot both win.
 */
export async function decideQuotation(opts: { quotationId: string; tenantId?: string; publicToken?: string; decision: 'Accepted' | 'Declined'; actor: string; reason?: string }): Promise<DecisionResult> {
  const db = await getDb();
  const where = [eq(schema.quotations.id, opts.quotationId), inArray(schema.quotations.status, OPEN_STATUSES)];
  if (opts.tenantId) where.push(eq(schema.quotations.tenantId, opts.tenantId));
  if (opts.publicToken) where.push(eq(schema.quotations.publicToken, opts.publicToken));
  const [q] = await db.update(schema.quotations).set({
    status: opts.decision, decidedAt: new Date(), decidedBy: opts.actor, declineReason: opts.decision === 'Declined' ? (opts.reason || '').slice(0, 500) : null,
  }).where(and(...where)).returning();

  if (!q) {
    const [cur] = await db.select().from(schema.quotations).where(eq(schema.quotations.id, opts.quotationId)).limit(1);
    if (!cur) return { ok: false, error: 'This quotation was not found.' };
    if (cur.status === 'Accepted') {
      // Already accepted: make sure its booking exists, but never create a second one.
      const { booking } = await ensureBookingForQuote(cur);
      return { ok: false, error: 'This quotation was already accepted.', status: cur.status, bookingId: booking.id };
    }
    return { ok: false, error: `This quotation is already ${cur.status.toLowerCase()}.`, status: cur.status };
  }

  await logQuoteEvent(q.tenantId, q.id, opts.decision === 'Accepted' ? 'accepted' : 'declined', opts.actor, opts.decision === 'Declined' ? (opts.reason || '') : '');
  if (opts.decision === 'Declined') return { ok: true, status: 'Declined' };

  const { booking, created } = await ensureBookingForQuote(q);
  let notification: { status: string; lastError: string | null } | undefined;
  if (created) {
    await logQuoteEvent(q.tenantId, q.id, 'booking_created', 'System', `Booking ${bookingNo(booking.number)} created automatically`);
    const [c] = await db.select().from(schema.customers).where(eq(schema.customers.id, q.customerId)).limit(1);
    const [t] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, q.tenantId)).limit(1);
    const n = await queueBookingConfirmation({ tenantId: q.tenantId, booking, customerName: c?.name ?? 'Customer', customerPhone: c?.phone ?? '', companyName: t?.name ?? '' });
    if (n) {
      notification = { status: n.status, lastError: n.lastError };
      await logQuoteEvent(q.tenantId, q.id, n.status === 'sent' ? 'whatsapp_sent' : 'whatsapp_failed', 'System', n.status === 'sent' ? 'Booking confirmation sent on WhatsApp' : (n.lastError ?? ''));
    }
  }
  return { ok: true, status: 'Accepted', bookingId: booking.id, bookingCreated: created, notification };
}
