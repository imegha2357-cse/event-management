import 'server-only';
import { and, eq, max, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import type { LineItem } from '@/db/schema';
import { docTotals, fy } from './catalog';
import { docCfg } from './docs';
import { isUniqueViolation } from './quotes';
import { newId, todayIST } from './util';

type Tenant = typeof schema.tenants.$inferSelect;
type Booking = typeof schema.bookings.$inferSelect;

/**
 * Creates the invoice for a booking (numbered per financial year, e.g. SLE/2026-27/0004).
 * Safe to call more than once: a booking never gets a second invoice.
 */
export async function insertInvoice(tenant: Tenant, b: Booking, o: { items: LineItem[]; discount: number; gst: boolean; issuedOn?: string; notes?: string }) {
  const db = await getDb();
  const find = async () => (await db.select().from(schema.invoices).where(eq(schema.invoices.bookingId, b.id)).limit(1))[0];
  const existing = await find();
  if (existing) return { invoice: existing, created: false };
  const cfg = docCfg(tenant);
  const issuedOn = o.issuedOn ?? todayIST();
  const t = docTotals(o.items, o.discount, o.gst, cfg.gstRate);
  const year = fy(issuedOn);
  for (let attempt = 0; attempt < 5; attempt++) {
    const [r] = await db.select({ m: max(schema.invoices.number) }).from(schema.invoices).where(and(eq(schema.invoices.tenantId, tenant.id), eq(schema.invoices.fy, year)));
    const number = (r?.m ?? 0) + 1;
    try {
      const [inv] = await db.insert(schema.invoices).values({ id: newId(), tenantId: tenant.id, fy: year, number, docNo: `${cfg.prefix}/${year}/${String(number).padStart(4, '0')}`, bookingId: b.id,
        quotationId: b.quotationId, customerId: b.customerId, issuedOn, items: o.items, discount: t.discount, gst: o.gst, gstRate: cfg.gstRate, subtotal: t.subtotal, tax: t.tax, total: t.total, notes: o.notes ?? '' }).returning();
      return { invoice: inv, created: true };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const again = await find(); // someone else just created it
      if (again) return { invoice: again, created: false };
    }
  }
  throw new Error('Could not create the invoice. Please try again.');
}

/** Invoice for an accepted quotation, with the quotation's items, discount and GST. */
export async function ensureInvoiceForQuote(q: typeof schema.quotations.$inferSelect, b: Booking) {
  const db = await getDb();
  const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, q.tenantId)).limit(1);
  if (!tenant) return null;
  return insertInvoice(tenant, b, { items: q.items, discount: q.discount, gst: q.gst });
}

/** Accepted bookings (from a quotation) that still have no invoice. */
export async function missingInvoiceBookings(ctx: { db: Awaited<ReturnType<typeof getDb>>; tenant: Tenant }) {
  const rows = await ctx.db.select({ b: schema.bookings, q: schema.quotations }).from(schema.bookings)
    .innerJoin(schema.quotations, eq(schema.quotations.id, schema.bookings.quotationId))
    .where(and(eq(schema.bookings.tenantId, ctx.tenant.id), eq(schema.quotations.status, 'Accepted'), sql`${schema.bookings.status} not in ('Cancelled','Declined')`,
      sql`not exists (select 1 from invoices i where i.booking_id = "bookings"."id")`));
  return rows;
}
