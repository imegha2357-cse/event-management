import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead } from '@/components/page';
import { Gate } from '@/components/locked';
import { PrintButton } from '@/components/decision';
import { moneyByBooking } from '@/lib/money';
import { EXP_CATS } from '@/lib/catalog';
import { fmtDate, inr, todayIST } from '@/lib/util';
export const metadata = { title: 'Compare events' };
const CAT_COL: Record<string, string> = { Food: '#2266d6', Decor: '#6b4eff', Staff: '#0f766e', Transport: '#e2a23b', Rental: '#be185d', Other: '#8a92a3' };

export default async function Compare({ searchParams }: { searchParams: Promise<{ ids?: string; add?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireUser();
  const g = gate(ctx, 'payments'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const bs = await ctx.db.select().from(schema.bookings).where(eq(schema.bookings.tenantId, ctx.tenant.id));
  const money = await moneyByBooking(ctx);
  const cands = bs.map(b => ({ b, m: money.get(b.id)! })).filter(x => x.m.quote > 0).sort((a, b) => b.b.eventDate.localeCompare(a.b.eventDate));
  let ids = (sp.ids ?? '').split(',').filter(Boolean);
  if (sp.add) ids = [...ids, sp.add];
  if (!sp.ids && !sp.add) ids = cands.filter(x => x.m.received > 0 && x.m.spent > 0).slice(0, 3).map(x => x.b.id);
  ids = [...new Set(ids)].filter(id => cands.some(c => c.b.id === id)).slice(0, 4);
  const sel = ids.map(id => cands.find(c => c.b.id === id)!);
  const margin = (m: { received: number; profit: number }) => (m.received ? Math.round((m.profit / m.received) * 100) : 0);
  const best = sel.length ? sel.reduce((a, b) => (margin(b.m) > margin(a.m) ? b : a)) : null;
  const worst = sel.length ? sel.reduce((a, b) => (margin(b.m) < margin(a.m) ? b : a)) : null;
  const catTot: Record<string, number> = {}; sel.forEach(x => Object.entries(x.m.byCat).forEach(([c, v]) => { catTot[c] = (catTot[c] ?? 0) + v; }));
  const topCat = Object.entries(catTot).sort((a, b) => b[1] - a[1])[0];
  const maxSpent = Math.max(1, ...sel.map(x => x.m.spent));
  const running = (x: (typeof sel)[number]) => x.b.eventDate >= todayIST() || x.b.status !== 'Completed';
  const others = cands.filter(c => !ids.includes(c.b.id));
  const row = (label: React.ReactNode, f: (x: (typeof sel)[number]) => React.ReactNode, cls = '') => <tr className={cls}><td>{label}</td>{sel.map(x => <td key={x.b.id} className="num">{f(x)}</td>)}</tr>;
  return (<>
    <PageHead title="Compare events" sub="See side by side which events earned the most and where the money went." actions={<PrintButton />} />
    <div className="body">
      <div className="field"><span className="label">Compare these events</span><div className="choices">
        {sel.map(x => <Link key={x.b.id} className="choice on" href={`/finance/compare?ids=${ids.filter(i => i !== x.b.id).join(',') || '-'}`} aria-label={`Remove ${x.b.title}`}>{x.b.title} ×</Link>)}
        {others.length > 0 && sel.length < 4 && <form style={{ display: 'inline-flex', gap: 6 }}><input type="hidden" name="ids" value={ids.join(',') || '-'} />
          <select name="add" className="input" style={{ height: 30, width: 240 }} aria-label="Add an event">{others.map(x => <option key={x.b.id} value={x.b.id}>{x.b.title} · {fmtDate(x.b.eventDate)}</option>)}</select><button className="btn sm">+ Add</button></form>}
      </div></div>
      {sel.length === 0 ? <div className="panel"><div className="empty"><b>Pick at least one event to compare</b>Events appear here once they have a quotation or invoice.</div></div> : (<>
        <div className="panel"><div className="tablewrap"><table className="cmp"><thead><tr><th />{sel.map(x => <th key={x.b.id} className="num"><b>{x.b.title}</b><div className="muted" style={{ fontWeight: 400, textTransform: 'none' }}>{x.b.eventType}{running(x) ? '*' : ''}</div></th>)}</tr></thead>
          <tbody>{row('Quote', x => inr(x.m.quote))}{row('Money received', x => inr(x.m.received))}{row('Money spent', x => inr(x.m.spent))}{row(<b>Profit</b>, x => <b>{inr(x.m.profit)}</b>, 'hl')}
            {row('Profit margin', x => x === best ? <span className="bestmark">{margin(x.m)}%</span> : <b>{margin(x.m)}%</b>)}
            {EXP_CATS.map(c => <tr key={c}><td className="muted">· {c}</td>{sel.map(x => <td key={x.b.id} className="num muted">{inr(x.m.byCat[c] ?? 0)}</td>)}</tr>)}</tbody></table></div></div>
        {sel.some(running) && <p className="small muted">*Still running, so its spending may rise.</p>}
        <div className="panel"><div className="panel-h"><h2>Where the money went</h2></div><div className="panel-b">
          {sel.map(x => <div className="stackrow" key={x.b.id}><span>{x.b.title}</span><div className="stack" style={{ width: `${(x.m.spent / maxSpent) * 100}%` }}>{EXP_CATS.filter(c => x.m.byCat[c]).map(c => <i key={c} style={{ flex: x.m.byCat[c], background: CAT_COL[c] }} title={`${c}: ${inr(x.m.byCat[c])}`} />)}</div><b>{inr(x.m.spent)}</b></div>)}
          <div className="legend">{EXP_CATS.map(c => <span key={c}><i style={{ background: CAT_COL[c] }} />{c}</span>)}</div></div></div>
        <div className="livebox"><b>What this tells you</b><ul className="notes">
          {best && <li><span className="nd good" />{best.b.title} earned the best margin ({margin(best.m)}%)</li>}
          {topCat && <li><span className="nd info" />{topCat[0]} is the biggest cost across these events ({inr(topCat[1])})</li>}
          {sel.length > 1 && worst && <li><span className="nd warn" />{worst.b.title} has the lowest margin so far ({margin(worst.m)}%)</li>}</ul></div>
      </>)}
    </div>
  </>);
}
