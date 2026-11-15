import Link from 'next/link';
import { and, desc, eq, sql } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser } from '@/lib/session';
import { PageHead, Badge, Empty } from '@/components/page';
import { Icon } from '@/components/icons';
import { IncomeSpend, lastMonths, monthName } from '@/components/charts';
import { allowed, has, LIMITS, MODULES, PLANS } from '@/lib/plans';
import { moneyByBooking, moneyStatus } from '@/lib/money';
import { monthlyMoney } from '@/lib/finance-data';
import { weatherFor, wxText } from '@/lib/weather';
import { quoteLabel } from '@/lib/docs';
import { fmtDate, inr, todayIST } from '@/lib/util';

export const metadata = { title: 'Dashboard' };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const daysUntil = (d: string, today: string) => Math.round((Date.parse(d) - Date.parse(today)) / 864e5);

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ cal?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireUser();
  const { db, tenant, user, tools } = ctx;
  const today = todayIST(), mk = today.slice(0, 7);
  const B = schema.bookings, Q = schema.quotations, C = schema.customers;
  const all = await db.select({ b: B, customer: C.name }).from(B).innerJoin(C, eq(C.id, B.customerId)).where(and(eq(B.tenantId, tenant.id), sql`${B.status} not in ('Cancelled','Declined')`));
  const upcoming = all.filter(x => x.b.eventDate >= today).sort((a, b) => a.b.eventDate.localeCompare(b.b.eventDate));
  const next30 = upcoming.filter(x => daysUntil(x.b.eventDate, today) <= 30).length;
  const money = await moneyByBooking(ctx);
  const mm = await monthlyMoney(ctx);
  const pending = all.reduce((s, x) => s + (money.get(x.b.id)?.pending ?? 0), 0);
  const owing = new Set(all.filter(x => (money.get(x.b.id)?.pending ?? 0) > 0).map(x => x.b.customerId)).size;
  const recent = await db.select({ q: Q, customer: C.name }).from(Q).innerJoin(C, eq(C.id, Q.customerId)).where(eq(Q.tenantId, tenant.id)).orderBy(desc(Q.createdAt)).limit(5);
  const sent = await db.select({ q: Q, customer: C.name }).from(Q).innerJoin(C, eq(C.id, Q.customerId)).where(and(eq(Q.tenantId, tenant.id), eq(Q.status, 'Sent')));
  const [failed] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.notifications).where(and(eq(schema.notifications.tenantId, tenant.id), eq(schema.notifications.status, 'failed')));
  const crewCounts = has(tenant, 'staff') ? await db.select({ id: schema.bookingCrew.bookingId, n: sql<number>`count(*)::int` }).from(schema.bookingCrew).where(eq(schema.bookingCrew.tenantId, tenant.id)).groupBy(schema.bookingCrew.bookingId) : [];
  const overdue = await db.select({ n: sql<number>`count(*)::int` }).from(schema.toolRows).where(and(eq(schema.toolRows.tenantId, tenant.id), eq(schema.toolRows.tool, 'planning'), eq(schema.toolRows.coll, 'tasks'),
    sql`${schema.toolRows.data}->>'status' <> 'Done'`, sql`${schema.toolRows.data}->>'due' < ${today}`));
  const notes: [string, string, string?][] = [];
  if (failed.n) notes.push(['bad', `${failed.n} WhatsApp message${failed.n === 1 ? ' has' : 's have'} failed`, '/settings#whatsapp']);
  upcoming.filter(x => daysUntil(x.b.eventDate, today) <= 7).forEach(x => { const m = money.get(x.b.id); if (m && m.quote && m.received === 0) notes.push(['bad', `${x.b.title} in ${daysUntil(x.b.eventDate, today)} days, no payment yet`, `/bookings/${x.b.id}`]); });
  if (has(tenant, 'staff')) upcoming.filter(x => x.b.crewNeeded).forEach(x => { const c = crewCounts.find(r => r.id === x.b.id)?.n ?? 0; if (c < x.b.crewNeeded) notes.push(['warn', `${x.b.crewNeeded - c} more crew needed for ${x.b.title}`, `/bookings/${x.b.id}`]); });
  sent.forEach(({ q, customer }) => notes.push(['info', `Quotation ${quoteLabel(tenant, q.number)} sent to ${customer}, waiting for reply`, `/quotations/${q.id}`]));
  if (overdue[0]?.n) notes.push(['warn', `${overdue[0].n} planning task${overdue[0].n > 1 ? 's are' : ' is'} overdue`, '/services/tools/planning']);
  const wx = await weatherFor(tenant.city);
  const calKey = /^\d{4}-\d{2}$/.test(sp.cal ?? '') ? sp.cal! : mk;
  const [cy, cm] = calKey.split('-').map(Number);
  const startPad = (new Date(Date.UTC(cy, cm - 1, 1)).getUTCDay() + 6) % 7, nDays = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
  const evDays = new Map<number, string[]>(); all.filter(x => x.b.eventDate.startsWith(calKey)).forEach(x => { const d = +x.b.eventDate.slice(8); evDays.set(d, [...(evDays.get(d) ?? []), x.b.title]); });
  const shift = (n: number) => new Date(Date.UTC(cy, cm - 1 + n, 1)).toISOString().slice(0, 7);
  const locked = MODULES.filter(m => !has(tenant, m.key));
  const months6 = lastMonths(6, mk);
  const lim = LIMITS[ctx.plan];
  const active = all.filter(x => x.b.status !== 'Completed').length;
  const showMoney = allowed(tenant, user.role, 'payments');
  return (
    <>
      <PageHead title="Dashboard" sub={`Here’s what’s happening across ${tenant.name} today, ${fmtDate(today)}.`}
        actions={<>{allowed(tenant, user.role, 'quotations') && <Link className="btn" href="/quotations/new">+ New quotation</Link>}{allowed(tenant, user.role, 'events') && <Link className="btn primary" href="/bookings/new">+ New booking</Link>}</>} />
      <div className="body">
        <div className="grid4">
          <div className="kpi"><div className="k">Upcoming events</div><div className="v">{String(next30).padStart(2, '0')}</div><div className="s">Next 30 days</div></div>
          {showMoney ? <>
            <div className="kpi"><div className="k">Money received</div><div className="v">{inr(mm.income(mk))}</div><div className="s">This month</div></div>
            <div className="kpi"><div className="k">Pending payments</div><div className="v">{inr(pending)}</div><div className="s">Across {owing} client{owing === 1 ? '' : 's'}</div></div>
            <div className="kpi"><div className="k">Net profit</div><div className="v">{inr(mm.income(mk) - mm.spend(mk))}</div><div className="s">This month (received − spent)</div></div>
          </> : <>
            <div className="kpi"><div className="k">Enquiries</div><div className="v">{all.filter(x => x.b.status === 'Enquiry').length}</div></div>
            <div className="kpi"><div className="k">Quotations waiting</div><div className="v">{sent.length}</div></div>
            <div className="kpi"><div className="k">Confirmed</div><div className="v">{all.filter(x => x.b.status === 'Confirmed').length}</div></div>
          </>}
        </div>
        <div className="split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="panel"><div className="panel-h"><div><h2>Upcoming events</h2><div className="small muted">Your next bookings and their payment status</div></div>
              <Link href={has(tenant, 'calendar') ? '/calendar' : '/bookings'} className="small">{has(tenant, 'calendar') ? 'View calendar →' : 'All bookings →'}</Link></div>
              {upcoming.length === 0 ? <Empty title="No upcoming events">Accepted quotations and new bookings appear here.</Empty> : upcoming.slice(0, 6).map(({ b, customer }) => { const m = money.get(b.id)!; return (
                <div className="moneyrow" key={b.id} style={{ gridTemplateColumns: '64px minmax(0,1fr) auto' }}>
                  <div style={{ textAlign: 'center' }}><b style={{ fontSize: 18 }}>{b.eventDate.slice(8)}</b><div className="small muted">{MON[+b.eventDate.slice(5, 7) - 1]}</div></div>
                  <div><Link className="strong" href={`/bookings/${b.id}`}>{b.title}</Link><div className="small muted">{b.eventType} · {b.guests} guests · {customer}</div></div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{b.status === 'Enquiry' ? <Badge s="Enquiry" /> : <><span className="num">{m.quote ? inr(m.quote) : ''}</span><span className={`badge ${moneyStatus(m)}`}>{moneyStatus(m)}</span></>}</div>
                </div>); })}
            </div>
            {showMoney && <div className="panel"><div className="panel-h"><div><h2>Income vs spending</h2><div className="small muted">Monthly cash flow · {monthName(months6[0])} to {monthName(mk)}</div></div></div>
              <div className="panel-b"><IncomeSpend months={months6} income={months6.map(mm.income)} spend={months6.map(mm.spend)} /></div></div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {wx && <div className="wx"><div className="wxtop"><span>{tenant.city.toUpperCase()} · TODAY</span><span>Live</span></div>
              <div className="wxmain"><b>{wx.temp}°</b><div><div>{wxText(wx.code)}</div><div className="wxs">Feels like {wx.feels}°</div></div></div>
              <div className="wxs">Humidity {wx.hum}% · Wind {wx.wind} km/h · Rain {wx.rain}%</div></div>}
            <div className="panel"><div className="panel-h"><h3>Notifications</h3><span className="badge info">{notes.length} new</span></div><div className="panel-b">
              <ul className="notes">{notes.length ? notes.slice(0, 6).map(([k, s, href], i) => <li key={i}><span className={`nd ${k}`} />{href ? <Link href={href}>{s}</Link> : s}</li>) : <li className="muted">All clear. Nothing needs your attention.</li>}</ul></div></div>
            <div className="panel"><div className="panel-h"><h3>{monthName(calKey)}</h3><div style={{ display: 'flex', gap: 2 }}><Link className="btn sm" href={`/dashboard?cal=${shift(-1)}`} aria-label="Previous month">‹</Link><Link className="btn sm" href={`/dashboard?cal=${shift(1)}`} aria-label="Next month">›</Link></div></div>
              <div className="panel-b"><div className="mcal">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => <b key={x}>{x}</b>)}
                {Array.from({ length: startPad }, (_, i) => <span key={'p' + i} />)}
                {Array.from({ length: nDays }, (_, i) => { const d = i + 1, ds = `${calKey}-${String(d).padStart(2, '0')}`; return <span key={d} className={(ds === today ? 'now ' : '') + (evDays.has(d) ? 'has' : '')} title={evDays.get(d)?.join(', ')}>{d}</span>; })}
              </div></div></div>
          </div>
        </div>
        {tools.length > 0 && allowed(tenant, user.role, 'tool:x') && <div className="panel"><div className="panel-h"><div><h2>Your service tools</h2><div className="small muted">Set up for the services {tenant.name} offers. Switch services on or off in Services → My services.</div></div></div>
          <div className="panel-b"><div className="toolgrid">{tools.map(t => <Link key={t.key} className="tool" href={`/services/tools/${t.key}`}><span className="ico"><Icon name={t.icon} /></span><span><b>{t.label}</b><span className="d">{t.blurb}</span></span></Link>)}</div></div></div>}
        <div className="split">
          <div className="panel"><div className="panel-h"><h2>Recent quotations</h2><Link href="/quotations" className="small">View all</Link></div>
            {recent.length === 0 ? <Empty title="No quotations yet"><Link href="/quotations/new">Create your first quotation</Link></Empty> : (
              <table><tbody>{recent.map(({ q, customer }) => <tr key={q.id}><td><Link href={`/quotations/${q.id}`} className="strong">{quoteLabel(tenant, q.number)}</Link><div className="small muted">{customer} · {q.eventTitle}</div></td><td className="num">{inr(q.total)}<div><Badge s={q.status} /></div></td></tr>)}</tbody></table>)}
          </div>
          <div className="panel"><div className="panel-h"><h3>Your {PLANS[ctx.plan].name} plan</h3>{user.role === 'Owner' && <Link href="/settings/plan" className="small">Plan details</Link>}</div><div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className="small muted">{PLANS[ctx.plan].blurb}. {inr(PLANS[ctx.plan].price)} per month.</p>
            {lim.events !== Infinity && <div><div className="small">Active events: <b>{active} of {lim.events}</b></div><div className="bar"><i style={{ width: `${Math.min(100, (active / lim.events) * 100)}%` }} /></div></div>}
            <p className="small muted">{locked.length ? <>Unlock with an upgrade: {locked.map(m => `${m.label} (${PLANS[m.plan].name})`).join(', ')}.</> : 'Every feature is switched on for your company.'}</p>
          </div></div>
        </div>
      </div>
    </>
  );
}
