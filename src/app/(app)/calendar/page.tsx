import Link from 'next/link';
import { and, asc, eq, gte, lte, ne } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { Gate } from '@/components/locked';
import { PageHead } from '@/components/page';
import { fmtTime, todayIST } from '@/lib/util';

export const metadata = { title: 'Calendar' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

export default async function Calendar({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const today = todayIST();
  const [y, m] = (/^\d{4}-\d{2}$/.test(sp.m ?? '') ? sp.m! : today.slice(0, 7)).split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const startOffset = (first.getUTCDay() + 6) % 7; // weeks start on Monday
  const gridStart = iso(y, m - 1, 1 - startOffset);
  const gridEnd = iso(y, m - 1, 1 - startOffset + 41);
  const ctx = await requireUser();
  const g = gate(ctx, 'calendar'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const { db, tenant } = ctx;
  const B = schema.bookings;
  const events = await db.select().from(B).where(and(eq(B.tenantId, tenant.id), ne(B.status, 'Cancelled'), gte(B.eventDate, gridStart), lte(B.eventDate, gridEnd))).orderBy(asc(B.eventDate), asc(B.startTime));
  const prev = iso(y, m - 2, 1).slice(0, 7), next = iso(y, m, 1).slice(0, 7);
  const days = Array.from({ length: 42 }, (_, i) => iso(y, m - 1, 1 - startOffset + i));
  const monthCount = events.filter(e => e.eventDate.slice(0, 7) === `${y}-${String(m).padStart(2, '0')}`).length;
  return (
    <>
      <PageHead title={`${MONTHS[m - 1]} ${y}`} sub={`${monthCount} event${monthCount === 1 ? '' : 's'} this month · confirmed in your colour, enquiries in amber`}
        actions={<><Link className="btn" href={`/calendar?m=${prev}`} aria-label="Previous month">‹</Link><Link className="btn" href="/calendar">Today</Link><Link className="btn" href={`/calendar?m=${next}`} aria-label="Next month">›</Link></>} />
      <div className="body">
        <div className="cal">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="dow">{d}</div>)}
          {days.map(d => (
            <div key={d} className={(d.slice(5, 7) !== String(m).padStart(2, '0') ? 'out ' : '') + (d === today ? 'today' : '')}>
              <span className="d">{Number(d.slice(8))}</span>
              {events.filter(e => e.eventDate === d).map(e => <Link key={e.id} className={'ev' + (e.status === 'Enquiry' ? ' enq' : '')} href={`/bookings/${e.id}`} title={e.title}>{e.startTime ? fmtTime(e.startTime) + ' ' : ''}{e.title}</Link>)}
            </div>))}
        </div>
      </div>
    </>
  );
}
