import Link from 'next/link';
import { and, asc, eq, notInArray } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead, Empty } from '@/components/page';
import { Gate } from '@/components/locked';
import { Icon } from '@/components/icons';
import { ActionButton } from '@/components/action-form';
import { AutoSelect } from '@/components/auto-select';
import { atLeast, PLANS } from '@/lib/plans';
import { DELIV_STAGES, type Col, type Tab } from '@/lib/tools';
import { computePurchase, dishCost, loadRows, type Row } from '@/lib/tool-server';
import { addDays, fmtDate, inr, todayIST } from '@/lib/util';
import { deleteToolRowAction, savePurchaseListAction, setToolFieldAction } from '../../actions';
import { ToolRowForm, type RField } from './row-form';
import { ChecklistForm } from './checklist';

export default async function ToolPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ tab?: string; menu?: string }> }) {
  const { key } = await params;
  const sp = await searchParams;
  const ctx = await requireUser();
  const tool = ctx.tools.find(t => t.key === key);
  if (!tool) return (<><PageHead title="Service tool" /><div className="body narrow"><div className="notice">This tool is not switched on. Turn on its service in <Link href="/services">My services</Link>.</div></div></>);
  const g = gate(ctx, `tool:${key}`); if (g) return <Gate g={g} plan={ctx.plan} />;
  const rows = await loadRows(ctx, tool.key);
  const today = todayIST();
  const evs = await ctx.db.select({ id: schema.bookings.id, title: schema.bookings.title, date: schema.bookings.eventDate, guests: schema.bookings.guests }).from(schema.bookings)
    .where(and(eq(schema.bookings.tenantId, ctx.tenant.id), notInArray(schema.bookings.status, ['Cancelled', 'Declined']))).orderBy(asc(schema.bookings.eventDate));
  const ev = (id?: string | null) => evs.find(e => e.id === id);
  const svcOn = new Set<string>(ctx.services.filter(s => s.on).map(s => s.key));
  const tabs = tool.tabs.filter(t => !t.needs || svcOn.has(t.needs));
  const tab = tabs.find(t => t.key === sp.tab) ?? tabs[0];
  const locked = tab.plan && !atLeast(ctx.tenant, tab.plan);
  const ings = rows.ingredients ?? [], dishes = rows.dishes ?? [];
  const plates = (r: Row) => Number(r.plates) || ev(r.bookingId)?.guests || 100;
  const menuPrice = (r: Row) => (r.dishes ?? []).reduce((s: number, id: string) => s + (Number(dishes.find(d => d.id === id)?.price) || 0), 0);
  const menuCost = (r: Row) => (r.dishes ?? []).reduce((s: number, id: string) => { const d = dishes.find(x => x.id === id); return s + (d ? dishCost(ings, d) : 0); }, 0);
  const bookedOn = (date: string, ref: string) => (rows.plans ?? []).filter(p => ev(p.bookingId)?.date === date).reduce((s, p) => s + (p.items ?? []).filter((i: { ref: string }) => i.ref === ref).reduce((a: number, i: { qty: number }) => a + i.qty, 0), 0);

  const CALC: Record<string, (r: Row) => React.ReactNode> = {
    plates: r => plates(r).toLocaleString('en-IN'),
    dishNames: r => <div className="chips">{(r.dishes ?? []).map((id: string) => dishes.find(d => d.id === id)).filter(Boolean).map((d: Row) => <span key={d.id} className="chip">{d.name}</span>)}</div>,
    menuPrice: r => inr(menuPrice(r)), menuCost: r => inr(menuCost(r)), menuValue: r => inr(menuPrice(r) * plates(r)),
    plistItems: r => (r.items ?? []).length,
    recipeText: r => <span className="small">{(r.recipe ?? []).map((x: { ref: string; qty: number }) => { const gI = ings.find(i => i.id === x.ref); return gI ? `${gI.name} ${x.qty} ${gI.unit}` : ''; }).filter(Boolean).join(', ')}</span>,
    dishCost: r => inr(dishCost(ings, r)),
    rateUnit: r => `${inr(r.rate)} / ${r.unit}`,
    usedIn: r => `${dishes.filter(d => (d.recipe ?? []).some((x: { ref: string }) => x.ref === r.id)).length} dishes`,
    setupWhen: r => <>{fmtDate(r.setupDate)}<div className="small muted">{r.setupTime}</div></>,
    itemsTaken: r => { const date = ev(r.bookingId)?.date ?? '';
      const short = (r.items ?? []).map((i: { ref: string; qty: number }) => { const it = (rows.items ?? []).find(x => x.id === i.ref); if (!it) return null; const b = bookedOn(date, i.ref); return b > Number(it.stock) ? `${it.name}: need ${b}, have ${it.stock}` : null; }).filter(Boolean);
      return <><span className="small">{(r.items ?? []).map((i: { ref: string; qty: number }) => { const it = (rows.items ?? []).find(x => x.id === i.ref); return it ? `${it.name} × ${i.qty}` : ''; }).filter(Boolean).join(', ') || '—'}</span>
        {short.length > 0 && <div><span className="chip bad" title={short.join('; ')}>Short of stock</span></div>}</>; },
    bookedUpcoming: r => (rows.plans ?? []).filter(p => (ev(p.bookingId)?.date ?? '') >= today).reduce((s, p) => s + (p.items ?? []).filter((i: { ref: string }) => i.ref === r.id).reduce((a: number, i: { qty: number }) => a + i.qty, 0), 0).toLocaleString('en-IN'),
    delivProgress: r => <div className="bar" style={{ width: 110 }}><i style={{ width: `${((DELIV_STAGES.indexOf(r.stage) + 1) / DELIV_STAGES.length) * 100}%` }} /></div>,
    orderValue: r => { const c = (rows.cards ?? []).find(x => x.id === r.card); return c ? inr(c.style === 'Digital' ? c.price : c.price * Number(r.qty)) : '—'; },
    cardPrice: r => r.style === 'Digital' ? `${inr(r.price)} per design` : `${inr(r.price)} per card`,
  };
  const cell = (c: Col, r: Row): React.ReactNode => {
    const k = c.c;
    switch (k.k) {
      case 'text': return <>{k.bold ? <b>{r[k.f]}</b> : r[k.f]}{k.sub && r[k.sub] && <div className="small muted">{r[k.sub]}</div>}</>;
      case 'num': return `${Number(r[k.f] || 0).toLocaleString('en-IN')}${k.unit ? ' ' + (r[k.unit] ?? '') : ''}`;
      case 'money': return k.bold ? <b>{inr(r[k.f])}</b> : inr(r[k.f]);
      case 'date': return <>{r[k.f] ? fmtDate(r[k.f]) : '—'}{k.late && r[k.f] && r[k.late.doneField] !== k.late.doneValue && r[k.f] < today && <div><span className="chip bad">Late</span></div>}</>;
      case 'event': { const e = ev(r.bookingId ?? r.eventId); return e ? <><Link href={`/bookings/${e.id}`}>{e.title}</Link><div className="small muted">{fmtDate(e.date)}</div></> : <span className="muted">—</span>; }
      case 'ref': return (rows[k.coll] ?? []).find(x => x.id === r[k.f])?.[k.show] ?? '—';
      case 'chip': return r[k.f] ? <span className={'chip ' + (r[k.f] === 'Veg' ? 'good' : r[k.f] === 'Non-veg' ? 'bad' : 'info')}>{r[k.f]}</span> : '—';
      case 'status': return <AutoSelect action={setToolFieldAction} fields={{ tool: tool.key, coll: tab.coll!, rid: r.id, f: k.f }} name="value" value={String(r[k.f] ?? k.opts[0])} options={k.opts} label={c.h} />;
      case 'calc': return CALC[k.fn]?.(r) ?? '';
    }
  };
  const evDate = (r: Row) => ev(r.bookingId ?? r.eventId)?.date ?? '9999';
  const sortRows = (list: Row[], how?: Tab['sort']) => {
    const xs = [...list];
    if (how === 'event') return xs.sort((a, b) => evDate(a).localeCompare(evDate(b)));
    if (how === 'event-time') return xs.sort((a, b) => evDate(a).localeCompare(evDate(b)) || String(a.time).localeCompare(String(b.time)));
    if (how === 'due') return xs.sort((a, b) => String(a.due).localeCompare(String(b.due)));
    return xs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  };
  const resolveDef = (d: unknown) => d === 'today' ? today : typeof d === 'string' && d.startsWith('today+') ? addDays(today, Number(d.slice(6))) : (d as string | number | undefined);
  const fields: RField[] = (tab.fields ?? []).map(f => ({ f: f.f, label: f.label, type: f.type ?? 'text', req: f.req, ph: f.ph, def: resolveDef(f.def),
    options: f.type === 'event' ? evs.filter(e => e.date >= addDays(today, -60)).map(e => [e.id, `${e.title} · ${fmtDate(e.date)}`] as [string, string])
      : f.opts ? f.opts.map(o => [o, o] as [string, string]) : f.ref ? (rows[f.ref.coll] ?? []).map(x => [x.id, f.ref!.label.map(l => x[l]).filter(Boolean).join(' · ')] as [string, string]) : undefined }));

  let body: React.ReactNode;
  if (locked) {
    body = <div className="panel"><div className="empty"><b>{tab.label} comes with the {PLANS[tab.plan!].name} plan</b><Link href="/settings/plan">See plans and request an upgrade</Link></div></div>;
  } else if (tab.special === 'purchaseGen') {
    const menus = rows.menus ?? [];
    const menu = menus.find(m => m.id === sp.menu) ?? menus[0];
    const list = menu ? computePurchase(ings, dishes, menu.dishes ?? [], plates(menu)) : [];
    const total = list.reduce((s, i) => s + i.qty * i.rate, 0);
    body = menus.length === 0 ? <div className="panel"><Empty title="No event menus yet">Plan a menu in the Event menus tab first.</Empty></div> : (
      <div className="panel">
        <div className="panel-h"><form style={{ display: 'flex', gap: 6 }}><input type="hidden" name="tab" value="gen" />
          <select name="menu" defaultValue={menu?.id} className="input" style={{ width: 300 }} aria-label="Event menu">{menus.map(m => <option key={m.id} value={m.id}>{ev(m.bookingId)?.title ?? 'Event'} · {plates(m)} plates</option>)}</select><button className="btn">Show</button></form>
          {menu && <ActionButton action={savePurchaseListAction} fields={{ menu: menu.id }} label="Save as purchase list" pendingText="Saving…" className="btn primary" />}</div>
        <div className="tablewrap"><table><thead><tr><th>Category</th><th>Ingredient</th><th className="num">Quantity to buy</th><th className="num">Rate</th><th className="num">Estimated cost</th></tr></thead><tbody>
          {list.map(i => <tr key={i.name}><td>{i.cat}</td><td><b>{i.name}</b></td><td className="num">{i.qty.toLocaleString('en-IN')} {i.unit}</td><td className="num">{inr(i.rate)}</td><td className="num">{inr(i.qty * i.rate)}</td></tr>)}
        </tbody><tfoot><tr><td colSpan={4}>Estimated total for {plates(menu!)} plates</td><td className="num">{inr(total)}</td></tr></tfoot></table></div>
      </div>);
  } else {
    const list = sortRows(rows[tab.coll!] ?? [], tab.sort);
    body = (<>
      {tab.toolbar === 'checklist' && <ChecklistForm events={evs.filter(e => e.date >= today).map(e => [e.id, `${e.title} · ${fmtDate(e.date)}`])} />}
      {!tab.noAdd && <ToolRowForm tool={tool.key} coll={tab.coll!} noun={tab.noun ?? 'Entry'} add={tab.add ?? '+ Add'} fields={fields} />}
      <div className="panel">{list.length === 0 ? <Empty title={`No ${(tab.noun ?? 'entrie').toLowerCase()}s yet`} /> : (
        <div className="tablewrap"><table><thead><tr>{tab.cols!.map(c => <th key={c.h} className={c.num ? 'num' : ''}>{c.h}</th>)}<th /></tr></thead><tbody>
          {list.map(r => <tr key={r.id}>{tab.cols!.map(c => <td key={c.h} className={c.num ? 'num' : ''}>{cell(c, r)}</td>)}
            <td className="num"><div style={{ display: 'inline-flex', gap: 6 }}>
              {tab.rowAction === 'purchase' && atLeast(ctx.tenant, 'pro') && <Link className="btn sm" href={`/services/tools/catering?tab=gen&menu=${r.id}`}>Purchase list</Link>}
              {tab.coll === 'plists' && <details><summary className="btn sm">View</summary><div style={{ position: 'absolute', right: 20, background: '#fff', border: '1px solid var(--line)', borderRadius: 6, padding: 10, zIndex: 3, maxHeight: 300, overflow: 'auto', textAlign: 'left' }}>
                <table><tbody>{(r.items ?? []).map((i: { name: string; qty: number; unit: string; rate: number }) => <tr key={i.name}><td>{i.name}</td><td className="num">{i.qty} {i.unit}</td><td className="num">{inr(i.qty * i.rate)}</td></tr>)}</tbody></table></div></details>}
              <ActionButton action={deleteToolRowAction} fields={{ tool: tool.key, rid: r.id }} label="Delete" className="btn sm danger" confirm="Delete this entry?" />
            </div></td></tr>)}
        </tbody></table></div>)}</div>
    </>);
  }
  return (<>
    <PageHead title={tool.title} sub={tool.intro} badge={<span className="tool" style={{ padding: 4, border: 0 }}><span className="ico"><Icon name={tool.icon} /></span></span>} />
    <div className="body">
      <div className="seg" role="tablist">{tabs.map(t => { const lk = t.plan && !atLeast(ctx.tenant, t.plan); const n = t.coll ? (rows[t.coll] ?? []).length : null; return (
        <Link key={t.key} role="tab" aria-selected={t === tab} className={t === tab ? 'on' : ''} href={`/services/tools/${tool.key}?tab=${t.key}`}>{lk && '🔒 '}{t.label}{n !== null && !lk ? ` (${n})` : ''}{lk ? ` · ${PLANS[t.plan!].name}` : ''}</Link>); })}</div>
      {tab.intro && <p className="small muted">{tab.intro}</p>}
      {body}
    </div>
  </>);
}
