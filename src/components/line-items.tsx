'use client';
import { useMemo, useState } from 'react';

export type SvcOpt = { key: string; name: string; price: number; unit: string };
type Item = { key: number; desc: string; qty: string; rate: string };
const rupee = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');

/**
 * Line items with "add one of your services", discount, optional GST and live totals.
 * Posts: items (JSON), discount, gst ("on"), gstRate.
 */
export function LineItems({ initial, services, guests, discount: d0, gst: g0, gstRate, gstAllowed, error, showAdvance }: {
  initial: { desc: string; qty: number; rate: number }[]; services: SvcOpt[]; guests?: number; discount?: number; gst?: boolean; gstRate: number; gstAllowed: boolean; error?: string; showAdvance?: boolean;
}) {
  const [items, setItems] = useState<Item[]>(() => (initial.length ? initial : [{ desc: '', qty: 1, rate: 0 }]).map((i, n) => ({ key: n + 1, desc: i.desc, qty: String(i.qty), rate: String(i.rate || '') })));
  const [next, setNext] = useState(1000);
  const [discount, setDiscount] = useState(String(d0 || ''));
  const [gst, setGst] = useState(Boolean(g0 && gstAllowed));
  const sub = useMemo(() => items.reduce((s, i) => s + Math.round((Number(i.qty) || 0) * (Number(i.rate) || 0)), 0), [items]);
  const disc = Math.min(Math.max(Number(discount) || 0, 0), sub);
  const half = gst ? Math.round(((sub - disc) * gstRate) / 200) : 0;
  const total = sub - disc + half * 2;
  const upd = (k: number, p: Partial<Item>) => setItems(xs => xs.map(x => (x.key === k ? { ...x, ...p } : x)));
  const add = (it?: Partial<Item>) => { setItems(xs => [...xs.filter(x => x.desc || x.rate || xs.length > 1), { key: next, desc: '', qty: '1', rate: '', ...it }]); setNext(n => n + 1); };
  const payload = JSON.stringify(items.filter(i => i.desc.trim() || Number(i.rate)).map(i => ({ desc: i.desc, qty: Number(i.qty), rate: Number(i.rate) })));
  return (
    <div className="panel">
      <input type="hidden" name="items" value={payload} />
      <div className="panel-h"><h2>Items</h2>
        {services.length > 0 && <select className="input" style={{ width: 280 }} value="" aria-label="Add one of your services" onChange={e => {
          const s = services.find(x => x.key === e.target.value); if (!s) return;
          add({ desc: `${s.name} (${s.unit})`, rate: String(s.price), qty: s.unit === 'per plate' && guests ? String(guests) : '1' });
        }}><option value="">+ Add one of your services…</option>{services.map(s => <option key={s.key} value={s.key}>{s.name} — {rupee(s.price)} {s.unit}</option>)}</select>}
      </div>
      <div className="tablewrap"><table className="items"><thead><tr><th style={{ width: '52%' }}>Description</th><th className="num" style={{ width: 100 }}>Qty</th><th className="num" style={{ width: 140 }}>Rate (₹)</th><th className="num">Amount</th><th style={{ width: 40 }} /></tr></thead>
        <tbody>{items.map((it, n) => (
          <tr key={it.key}>
            <td><input className="input" aria-label={`Item ${n + 1} description`} value={it.desc} onChange={e => upd(it.key, { desc: e.target.value })} placeholder="What you will provide" /></td>
            <td><input className="input num" aria-label={`Item ${n + 1} quantity`} type="number" min={0} step="any" value={it.qty} onChange={e => upd(it.key, { qty: e.target.value })} /></td>
            <td><input className="input num" aria-label={`Item ${n + 1} rate`} type="number" min={0} step="1" value={it.rate} onChange={e => upd(it.key, { rate: e.target.value })} /></td>
            <td className="num">{rupee((Number(it.qty) || 0) * (Number(it.rate) || 0))}</td>
            <td><button type="button" className="iconbtn" aria-label={`Remove item ${n + 1}`} disabled={items.length === 1} onClick={() => setItems(xs => xs.filter(x => x.key !== it.key))}>×</button></td>
          </tr>))}</tbody>
      </table></div>
      <div className="panel-b" style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><button type="button" className="btn sm" onClick={() => add()}>+ Add custom line</button></div>
          {error && <div className="ferr" role="alert">{error}</div>}
          {gstAllowed ? <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" name="gst" checked={gst} onChange={e => setGst(e.target.checked)} /> Add GST at {gstRate}% (CGST {gstRate / 2}% + SGST {gstRate / 2}%)</label>
            : <span className="small muted">No GSTIN in company settings, so no tax is added.</span>}
          <input type="hidden" name="gstRate" value={gstRate} />
        </div>
        <div className="totals">
          <span>Subtotal</span><span className="num">{rupee(sub)}</span>
          <label htmlFor="discount">Discount (₹)</label><input id="discount" name="discount" type="number" min={0} className="input num" style={{ width: 120, height: 30 }} value={discount} onChange={e => setDiscount(e.target.value)} />
          {gst && <><span>CGST {gstRate / 2}%</span><span className="num">{rupee(half)}</span><span>SGST {gstRate / 2}%</span><span className="num">{rupee(half)}</span></>}
          <span className="grand">Total</span><span className="grand num">{rupee(total)}</span>
          {showAdvance && <><span className="muted small">Advance to confirm (50%)</span><span className="num muted small">{rupee(total / 2)}</span></>}
        </div>
      </div>
    </div>
  );
}
