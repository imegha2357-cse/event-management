import Link from 'next/link';
import { and, asc, desc, eq, gte, ilike, lt, notInArray, or, sql } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead, Empty } from '@/components/page';
import { Gate } from '@/components/locked';
import { AutoSelect } from '@/components/auto-select';
import { fmtDate, fmtTime, inr, bookingNo, todayIST } from '@/lib/util';
import { BASE_STATUSES, NOT_BOOKINGS, SVC } from '@/lib/catalog';
import { isEnt, LIMITS } from '@/lib/plans';
import { setBookingStatusAction } from './actions';

export const metadata = { title: 'Bookings' };
const VIEWS = [{ k: 'upcoming', l: 'Upcoming' }, { k: 'past', l: 'Past' }, { k: 'all', l: 'All' }];

export default async function Bookings({ searchParams }: { searchParams: Promise<{ view?: string; status?: string; q?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireUser();
  const g = gate(ctx, 'events'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const { db, tenant, custom } = ctx;
  const ent = isEnt(tenant);
  const statuses = [...BASE_STATUSES, ...(ent ? custom.statuses ?? [] : [])];
  const view = VIEWS.some(v => v.k === sp.view) ? sp.view! : 'upcoming';
  const status = statuses.includes(sp.status ?? '') ? sp.status! : '';
  const q = (sp.q ?? '').trim();
  const B = schema.bookings, C = schema.customers, today = todayIST();
  const rows = await db.select({ b: B, customer: C.name }).from(B).innerJoin(C, eq(C.id, B.customerId)).where(and(
    eq(B.tenantId, tenant.id),
    notInArray(B.status, NOT_BOOKINGS),
    view === 'upcoming' ? gte(B.eventDate, today) : view === 'past' ? lt(B.eventDate, today) : undefined,
    status ? eq(B.status, status) : undefined,
    q ? or(ilike(B.title, `%${q}%`), ilike(C.name, `%${q}%`), ilike(B.venue, `%${q}%`)) : undefined,
  )).orderBy(view === 'past' ? desc(B.eventDate) : asc(B.eventDate)).limit(400);
  const counts = await db.select({ s: B.status, n: sql<number>`count(*)::int` }).from(B).where(and(eq(B.tenantId, tenant.id), notInArray(B.status, NOT_BOOKINGS))).groupBy(B.status);
  const cnt = (s: string) => counts.find(c => c.s === s)?.n ?? 0;
  const [{ n: customers }] = await db.select({ n: sql<number>`count(*)::int` }).from(C).where(eq(C.tenantId, tenant.id));
  const active = counts.filter(c => !['Completed', 'Cancelled'].includes(c.s)).reduce((a, c) => a + c.n, 0);
  const lim = LIMITS[ctx.plan].events;
  const branches = ent ? custom.branches ?? [] : [];
  const fields = ent ? custom.eventFields ?? [] : [];
  const link = (p: Record<string, string>) => '/bookings?' + new URLSearchParams({ view, ...(status ? { status } : {}), ...(q ? { q } : {}), ...p }).toString();
  return (
    <>
      <PageHead title="Bookings" sub="Confirmed events only. Accepted quotations become bookings automatically; declined ones never appear here."
        actions={<Link className="btn primary" href="/bookings/new">+ New booking</Link>} />
      <div className="body">
        {lim !== Infinity && active >= lim - 2 && <div className={active >= lim ? 'formerror' : 'notice warn'}>{active} of {lim} active events used on the Basic plan. <Link href="/settings/plan">See plans</Link></div>}
        <div className="grid4">
          <div className="kpi"><div className="k">Total bookings</div><div className="v">{counts.reduce((a, c) => a + c.n, 0)}</div></div>
          <div className="kpi"><div className="k">Completed</div><div className="v">{cnt('Completed')}</div></div>
          <div className="kpi"><div className="k">Confirmed</div><div className="v">{cnt('Confirmed')}</div></div>
          <div className="kpi"><div className="k">Customers</div><div className="v">{customers}</div></div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="seg">{VIEWS.map(v => <Link key={v.k} className={v.k === view ? 'on' : ''} href={link({ view: v.k })}>{v.l}</Link>)}</div>
          <div className="seg"><Link className={!status ? 'on' : ''} href={'/bookings?' + new URLSearchParams({ view, ...(q ? { q } : {}) })}>All statuses</Link>
            {statuses.map(s => <Link key={s} className={s === status ? 'on' : ''} href={link({ status: s })}>{s}</Link>)}</div>
          <form style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}><input type="hidden" name="view" value={view} />{status && <input type="hidden" name="status" value={status} />}
            <input name="q" defaultValue={q} className="input" placeholder="Search event, customer, venue" aria-label="Search bookings" style={{ width: 230 }} /><button className="btn">Search</button></form>
        </div>
        <div className="panel">
          {rows.length === 0 ? <Empty title="No bookings match">Create one with “New booking”, or send a quotation your customer can accept.</Empty> : (
            <div className="tablewrap"><table><thead><tr><th>Date</th><th>Event</th><th>Customer</th><th>Venue</th><th>Services</th><th>Status</th><th className="num">Amount</th><th className="num">Quotation</th></tr></thead><tbody>
              {rows.map(({ b, customer }) => (
                <tr key={b.id}>
                  <td className="nowrap">{fmtDate(b.eventDate)}<div className="small muted">{fmtTime(b.startTime)}</div></td>
                  <td><Link className="strong" href={`/bookings/${b.id}`}>{b.title}</Link><div className="small muted">{bookingNo(b.number)} · {b.eventType} · {b.guests} guests
                    {b.branchId && branches.find(x => x.id === b.branchId) && <span className="chip info" style={{ marginLeft: 6 }}>{branches.find(x => x.id === b.branchId)!.name}</span>}</div>
                    {fields.filter(f => b.custom?.[f.id]).map(f => <div key={f.id} className="small muted">{f.label}: {b.custom[f.id]}</div>)}</td>
                  <td>{customer}</td><td>{b.venue}</td>
                  <td><div className="chips">{(b.services ?? []).map(k => <span key={k} className="chip">{SVC[k]?.name ?? k}</span>)}</div></td>
                  <td><AutoSelect action={setBookingStatusAction} fields={{ rid: b.id }} name="status" value={b.status} options={statuses} label={`Status of ${b.title}`} /></td>
                  <td className="num">{b.total ? inr(b.total) : <span className="muted">—</span>}</td>
                  <td className="num">{b.quotationId ? <Link className="decided ok" href={`/quotations/${b.quotationId}`}>✓ Accepted</Link> : <span className="muted small">Direct booking</span>}</td>
                </tr>))}
            </tbody></table></div>)}
        </div>
      </div>
    </>
  );
}
