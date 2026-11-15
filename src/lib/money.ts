import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { schema } from '@/db';
import type { Ctx } from './session';

export type EventMoney = { quote: number; received: number; pending: number; spent: number; profit: number; byCat: Record<string, number>; invoiceId?: string };

/** Money for each booking: quoted/invoiced amount, payments received, expenses spent. */
export async function moneyByBooking(ctx: Pick<Ctx, 'db' | 'tenant'>, bookingIds?: string[]) {
  const { db, tenant } = ctx;
  const I = schema.invoices, P = schema.invoicePayments, E = schema.expenses, B = schema.bookings;
  const bWhere = bookingIds ? and(eq(B.tenantId, tenant.id), inArray(B.id, bookingIds.length ? bookingIds : ['-'])) : eq(B.tenantId, tenant.id);
  const bookings = await db.select({ id: B.id, total: B.total }).from(B).where(bWhere);
  const invs = await db.select({ id: I.id, bookingId: I.bookingId, total: I.total, paid: sql<number>`coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = "invoices"."id"),0)::int` })
    .from(I).where(eq(I.tenantId, tenant.id));
  const exps = await db.select({ bookingId: E.bookingId, category: E.category, amount: E.amount }).from(E).where(eq(E.tenantId, tenant.id));
  const out = new Map<string, EventMoney>();
  for (const b of bookings) {
    const mine = invs.filter(i => i.bookingId === b.id);
    const quote = mine.length ? mine.reduce((s, i) => s + i.total, 0) : b.total;
    const received = mine.reduce((s, i) => s + i.paid, 0);
    const ex = exps.filter(x => x.bookingId === b.id);
    const byCat: Record<string, number> = {};
    for (const x of ex) byCat[x.category] = (byCat[x.category] ?? 0) + x.amount;
    const spent = ex.reduce((s, x) => s + x.amount, 0);
    out.set(b.id, { quote, received, pending: Math.max(quote - received, 0), spent, profit: received - spent, byCat, invoiceId: mine[0]?.id });
  }
  return out;
}

export function moneyStatus(m: EventMoney) {
  if (!m.quote) return 'No quote';
  if (m.received >= m.quote) return 'Paid';
  return m.received > 0 ? 'Partly paid' : 'Unpaid';
}

export async function invoicePaid(ctx: Pick<Ctx, 'db'>, invoiceId: string) {
  const [r] = await ctx.db.select({ s: sql<number>`coalesce(sum(${schema.invoicePayments.amount}),0)::int` }).from(schema.invoicePayments).where(eq(schema.invoicePayments.invoiceId, invoiceId));
  return r?.s ?? 0;
}

/** Active (not completed or cancelled) bookings, for the Basic plan limit. */
export async function activeEventCount(ctx: Pick<Ctx, 'db' | 'tenant'>) {
  const [r] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(schema.bookings)
    .where(and(eq(schema.bookings.tenantId, ctx.tenant.id), sql`${schema.bookings.status} not in ('Completed','Cancelled')`));
  return r?.n ?? 0;
}
