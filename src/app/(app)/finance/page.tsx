import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead, Empty } from '@/components/page';
import { Gate } from '@/components/locked';
import { IncomeSpend, lastMonths, monthName } from '@/components/charts';
import { moneyByBooking, moneyStatus } from '@/lib/money';
import { monthlyMoney } from '@/lib/finance-data';
import { perk } from '@/lib/plans';
import { fmtDate, inr, todayIST, waNumber } from '@/lib/util';

export const metadata = { title: 'Finance' };
const days = (d: string) => Math.round((Date.parse(d) - Date.parse(todayIST())) / 864e5);

export default async function Finance({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireUser();
  const g = gate(ctx, 'payments'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const { db, tenant } = ctx;
  const today = todayIST();
  const months12 = lastMonths(12, today).reverse();
  const mk = months12.includes(sp.month ?? '') ? sp.month! : today.slice(0, 7);
  const bookings = await db.select({ b: schema.bookings, c: schema.customers }).from(schema.bookings).innerJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId)).where(eq(schema.bookings.tenantId, tenant.id));
  const money = await moneyByBooking(ctx);
  const evs = bookings.map(x => ({ ...x, m: money.get(x.b.id)! })).filter(x => x.m.quote > 0 && x.b.status !== 'Cancelled');
  const pending = evs.reduce((s, x) => s + x.m.pending, 0);
  const owing = new Set(evs.filter(x => x.m.pending > 0).map(x => x.b.customerId)).size;
  const soon = evs.filter(x => x.b.eventDate >= today && x.m.received === 0).sort((a, b) => a.b.eventDate.localeCompare(b.b.eventDate))[0];
  const mm = await monthlyMoney(ctx);
  const months6 = lastMonths(6, mk);
  const order = [...evs].sort((a, b) => { const fa = a.b.eventDate >= today, fb = b.b.eventDate >= today; if (fa !== fb) return fa ? -1 : 1; return fa ? a.b.eventDate.localeCompare(b.b.eventDate) : b.b.eventDate.localeCompare(a.b.eventDate); });
  const wa = perk(tenant, 'whatsappShare');
  return (
    <>
      <PageHead title="Finance" sub="Who owes you money, money in, money out, and profit."
        actions={<form style={{ display: 'flex', gap: 6 }}><select name="month" defaultValue={mk} className="input" aria-label="Month" style={{ width: 170 }}>{months12.map(k => <option key={k} value={k}>{monthName(k)}</option>)}</select><button className="btn">Show</button></form>} />
      <div className="body">
        <div className="hero"><div><span>Still pending from clients</span><b>{inr(pending)}</b></div>
          <div style={{ textAlign: 'right' }}><span>{owing} client{owing === 1 ? ' owes' : 's owe'} you</span><b className="hero-s">{soon ? `${soon.b.title} in ${days(soon.b.eventDate)} days, nothing paid` : 'No upcoming event is unpaid'}</b></div></div>
        <div className="grid3">
          <div className="kpi"><div className="k">Money received</div><div className="v">{inr(mm.income(mk))}</div><div className="s">Money in · {monthName(mk)}</div></div>
          <div className="kpi"><div className="k">Money spent</div><div className="v">{inr(mm.spend(mk))}</div><div className="s">Money out · {monthName(mk)}</div></div>
          <div className="kpi"><div className="k">Profit</div><div className="v">{inr(mm.income(mk) - mm.spend(mk))}</div><div className="s">Received minus spent</div></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn primary lg" href="/finance/payment">Record payment</Link><Link className="btn lg" href="/finance/expense">Add expense</Link>
          <Link className="btn lg" href="/bookings">Create invoice</Link><Link className="btn lg" href="/finance/compare">Compare events</Link>
        </div>
        <div className="panel"><div className="panel-h"><h2>Events and their money</h2><span className="small muted">Open an event to see its payments, expenses and profit.</span></div>
          {order.length === 0 ? <Empty title="No quotations or invoices yet" /> : order.map(({ b, c, m }) => { const du = days(b.eventDate); return (
            <div className="moneyrow" key={b.id}>
              <div><Link className="strong" href={`/bookings/${b.id}`}>{b.title}</Link><div className="small muted">{fmtDate(b.eventDate)} · {b.eventType}{du >= 0 && du <= 14 ? ` · event in ${du} day${du === 1 ? '' : 's'}` : ''}</div></div>
              <div className="small muted">Quote {inr(m.quote)} · Paid {inr(m.received)}</div>
              <div className="mr-right"><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {wa && m.pending > 0 && c.phone && <a className="btn sm good" target="_blank" rel="noopener noreferrer" aria-label={`Send WhatsApp reminder to ${c.name}`}
                  href={`https://wa.me/${waNumber(c.phone)}?text=${encodeURIComponent(`Vanakkam ${c.name}, a gentle reminder from ${tenant.name}: ${inr(m.pending)} is pending for ${b.title} on ${fmtDate(b.eventDate)}. Thank you!`)}`}>Remind</a>}
                <span className={`badge ${moneyStatus(m)}`}>{moneyStatus(m)}</span></div>
                <div className="bar" style={{ width: '100%' }}><i style={{ width: `${Math.min(100, (m.received / m.quote) * 100)}%` }} /></div></div>
            </div>); })}
        </div>
        <div className="panel"><div className="panel-h"><h2>Income vs spending</h2><span className="small muted">{monthName(months6[0])} to {monthName(mk)}</span></div>
          <div className="panel-b"><IncomeSpend months={months6} income={months6.map(mm.income)} spend={months6.map(mm.spend)} /></div></div>
      </div>
    </>
  );
}
