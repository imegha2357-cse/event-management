import Link from 'next/link';
import { and, desc, eq, gte, asc, inArray, sql } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser } from '@/lib/session';
import { PageHead, Badge, Empty } from '@/components/page';
import { fmtDate, fmtTime, inr, quoteNo, bookingNo, todayIST } from '@/lib/util';

export const metadata = { title: 'Dashboard' };

export default async function Dashboard() {
  const { db, tenant, user } = await requireUser();
  const today = todayIST();
  const monthStart = today.slice(0, 8) + '01';
  const T = schema.quotations, B = schema.bookings, C = schema.customers;
  const [open] = await db.select({ n: sql<number>`count(*)::int`, v: sql<number>`coalesce(sum(${T.total}),0)::int` }).from(T).where(and(eq(T.tenantId, tenant.id), inArray(T.status, ['Draft', 'Sent'])));
  const [won] = await db.select({ n: sql<number>`count(*)::int`, v: sql<number>`coalesce(sum(${T.total}),0)::int` }).from(T)
    .where(and(eq(T.tenantId, tenant.id), eq(T.status, 'Accepted'), gte(T.decidedAt, new Date(monthStart + 'T00:00:00+05:30'))));
  const [decided] = await db.select({ a: sql<number>`count(*) filter (where ${T.status}='Accepted')::int`, d: sql<number>`count(*) filter (where ${T.status}='Declined')::int` }).from(T).where(eq(T.tenantId, tenant.id));
  const [failed] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.notifications).where(and(eq(schema.notifications.tenantId, tenant.id), eq(schema.notifications.status, 'failed')));
  const upcoming = await db.select({ b: B, customer: C.name }).from(B).innerJoin(C, eq(C.id, B.customerId))
    .where(and(eq(B.tenantId, tenant.id), eq(B.status, 'Confirmed'), gte(B.eventDate, today))).orderBy(asc(B.eventDate), asc(B.startTime)).limit(8);
  const recent = await db.select({ q: T, customer: C.name }).from(T).innerJoin(C, eq(C.id, T.customerId)).where(eq(T.tenantId, tenant.id)).orderBy(desc(T.createdAt)).limit(6);
  const rate = decided.a + decided.d ? Math.round((decided.a / (decided.a + decided.d)) * 100) : null;

  return (
    <>
      <PageHead title={`Hello, ${user.name.split(' ')[0]}`} sub={`${fmtDate(today)} · ${tenant.name}`}
        actions={<><Link className="btn" href="/customers/new">New customer</Link><Link className="btn primary" href="/quotations/new">+ New quotation</Link></>} />
      <div className="body">
        {failed.n > 0 && <div className="formerror">{failed.n} WhatsApp {failed.n === 1 ? 'message has' : 'messages have'} failed. <Link href="/settings#whatsapp">Review and retry</Link></div>}
        <div className="grid4">
          <div className="kpi"><div className="k">Open quotations</div><div className="v">{open.n}</div><div className="s">{inr(open.v)} awaiting a decision</div></div>
          <div className="kpi"><div className="k">Accepted this month</div><div className="v">{inr(won.v)}</div><div className="s">{won.n} quotation{won.n === 1 ? '' : 's'}</div></div>
          <div className="kpi"><div className="k">Upcoming events</div><div className="v">{upcoming.length}{upcoming.length === 8 ? '+' : ''}</div><div className="s">Confirmed, from today</div></div>
          <div className="kpi"><div className="k">Win rate</div><div className="v">{rate === null ? '—' : `${rate}%`}</div><div className="s">{decided.a} accepted · {decided.d} declined</div></div>
        </div>
        <div className="split">
          <div className="panel">
            <div className="panel-h"><h2>Upcoming events</h2><Link href="/calendar" className="small">Open calendar</Link></div>
            {upcoming.length === 0 ? <Empty title="No upcoming events">Accepted quotations appear here as bookings.</Empty> : (
              <div className="tablewrap"><table><thead><tr><th>Date</th><th>Booking</th><th>Customer</th><th>Venue</th><th className="num">Amount</th></tr></thead><tbody>
                {upcoming.map(({ b, customer }) => (
                  <tr key={b.id}><td className="nowrap">{fmtDate(b.eventDate)}<div className="small muted">{fmtTime(b.startTime)}</div></td>
                    <td><Link className="strong" href={`/bookings/${b.id}`}>{b.title}</Link><div className="small muted">{bookingNo(b.number)} · {b.eventType}</div></td>
                    <td>{customer}</td><td>{b.venue}</td><td className="num">{inr(b.total)}</td></tr>))}
              </tbody></table></div>)}
          </div>
          <div className="panel">
            <div className="panel-h"><h2>Recent quotations</h2><Link href="/quotations" className="small">View all</Link></div>
            {recent.length === 0 ? <Empty title="No quotations yet"><Link href="/quotations/new">Create your first quotation</Link></Empty> : (
              <table><tbody>{recent.map(({ q, customer }) => (
                <tr key={q.id}><td><Link href={`/quotations/${q.id}`} className="strong">{quoteNo(q.number)}</Link><div className="small muted">{customer}</div></td>
                  <td className="num">{inr(q.total)}<div><Badge s={q.status} /></div></td></tr>))}</tbody></table>)}
          </div>
        </div>
      </div>
    </>
  );
}
