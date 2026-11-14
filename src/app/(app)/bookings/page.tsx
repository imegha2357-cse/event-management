import Link from 'next/link';
import { and, asc, desc, eq, gte, lt } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser } from '@/lib/session';
import { PageHead, Badge, Empty } from '@/components/page';
import { fmtDate, fmtTime, inr, bookingNo, todayIST } from '@/lib/util';

export const metadata = { title: 'Bookings' };
const TABS = [{ k: 'upcoming', l: 'Upcoming' }, { k: 'past', l: 'Past' }, { k: 'cancelled', l: 'Cancelled' }];

export default async function Bookings({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sp = await searchParams;
  const view = TABS.some(t => t.k === sp.view) ? sp.view! : 'upcoming';
  const { db, tenant } = await requireUser();
  const B = schema.bookings, C = schema.customers, today = todayIST();
  const where = view === 'cancelled' ? and(eq(B.tenantId, tenant.id), eq(B.status, 'Cancelled'))
    : view === 'past' ? and(eq(B.tenantId, tenant.id), lt(B.eventDate, today))
    : and(eq(B.tenantId, tenant.id), gte(B.eventDate, today));
  const rows = await db.select({ b: B, customer: C.name }).from(B).innerJoin(C, eq(C.id, B.customerId)).where(where)
    .orderBy(view === 'upcoming' ? asc(B.eventDate) : desc(B.eventDate)).limit(300);
  const shown = view === 'cancelled' ? rows : rows.filter(r => r.b.status !== 'Cancelled');
  return (
    <>
      <PageHead title="Bookings" sub="Bookings are created automatically when a customer accepts a quotation." actions={<Link className="btn primary" href="/quotations/new">+ New quotation</Link>} />
      <div className="body">
        <div className="seg">{TABS.map(t => <Link key={t.k} className={t.k === view ? 'on' : ''} href={`/bookings?view=${t.k}`}>{t.l}</Link>)}</div>
        <div className="panel">
          {shown.length === 0 ? <Empty title={`No ${TABS.find(t => t.k === view)!.l.toLowerCase()} bookings`}>When a customer accepts a quotation, the booking appears here.</Empty> : (
            <div className="tablewrap"><table><thead><tr><th>Date</th><th>Booking</th><th>Customer</th><th>Venue</th><th>Status</th><th className="num">Amount</th></tr></thead><tbody>
              {shown.map(({ b, customer }) => (
                <tr key={b.id}><td className="nowrap">{fmtDate(b.eventDate)}<div className="small muted">{fmtTime(b.startTime)}</div></td>
                  <td><Link className="strong" href={`/bookings/${b.id}`}>{b.title}</Link><div className="small muted">{bookingNo(b.number)} · {b.eventType}</div></td>
                  <td>{customer}</td><td>{b.venue}</td><td><Badge s={b.status} /></td><td className="num">{inr(b.total)}</td></tr>))}
            </tbody></table></div>)}
        </div>
      </div>
    </>
  );
}
