'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Field, FormMessage, SubmitButton, useFormAction } from '@/components/ui';
import { saveQuotationAction } from '../actions';

type Item = { key: number; desc: string; qty: string; rate: string };
export type QuoteInit = {
  id?: string; customerId: string; eventType: string; eventTitle: string; eventDate: string; startTime: string; endTime: string;
  venue: string; guests: number; validUntil: string; discount: number; notes: string; items: { desc: string; qty: number; rate: number }[];
};

const EVENT_TYPES = ['Wedding', 'Reception', 'Engagement', 'Birthday', 'Puberty function', 'House warming', 'Corporate event', 'Other'];
const PRESETS = [
  { desc: 'Veg meals (per plate)', rate: 350, perGuest: true }, { desc: 'Non-veg meals (per plate)', rate: 450, perGuest: true },
  { desc: 'Stage decoration', rate: 45000 }, { desc: 'Entrance & hall decoration', rate: 25000 }, { desc: 'Lighting', rate: 18000 },
  { desc: 'Sound system & DJ', rate: 15000 }, { desc: 'Photography & video', rate: 40000 }, { desc: 'Serving staff (per person)', rate: 800 },
];
const rupee = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');

export function QuoteForm({ init, customers, today }: { init: QuoteInit; customers: { id: string; name: string; phone: string }[]; today: string }) {
  const { state, action, onSubmit, pending } = useFormAction(saveQuotationAction);
  const fe = state?.fieldErrors ?? {};
  let seq = 0;
  const [items, setItems] = useState<Item[]>(() => (init.items.length ? init.items : [{ desc: '', qty: 1, rate: 0 }]).map(i => ({ key: ++seq, desc: i.desc, qty: String(i.qty), rate: String(i.rate || '') })));
  const [nextKey, setNextKey] = useState(1000);
  const [guests, setGuests] = useState(String(init.guests || ''));
  const [discount, setDiscount] = useState(String(init.discount || ''));
  const subtotal = useMemo(() => items.reduce((s, i) => s + Math.round((Number(i.qty) || 0) * (Number(i.rate) || 0)), 0), [items]);
  const disc = Math.min(Math.max(Number(discount) || 0, 0), subtotal);

  const update = (key: number, patch: Partial<Item>) => setItems(xs => xs.map(x => (x.key === key ? { ...x, ...patch } : x)));
  const add = (it?: Partial<Item>) => { setItems(xs => [...xs.filter(x => x.desc || x.rate || xs.length > 1), { key: nextKey, desc: '', qty: '1', rate: '', ...it }]); setNextKey(k => k + 1); };
  const payload = JSON.stringify(items.filter(i => i.desc.trim() || Number(i.rate)).map(i => ({ desc: i.desc, qty: Number(i.qty), rate: Number(i.rate) })));

  return (
    <form action={action} onSubmit={onSubmit} noValidate>
      {init.id && <input type="hidden" name="rid" value={init.id} />}
      <input type="hidden" name="items" value={payload} />
      <div className="body">
        <FormMessage state={state} />
        <div className="panel">
          <div className="panel-h"><h2>Customer & event</h2></div>
          <div className="panel-b grid3">
            <Field label="Customer" htmlFor="customerId" error={fe.customerId} required>
              <select id="customerId" name="customerId" className="input" defaultValue={init.customerId} aria-invalid={!!fe.customerId || undefined}>
                <option value="">Choose a customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
              </select>
              <Link href="/customers/new?returnTo=quote" className="small">+ Add a new customer</Link>
            </Field>
            <Field label="Event type" htmlFor="eventType" error={fe.eventType} required>
              <select id="eventType" name="eventType" className="input" defaultValue={init.eventType}>
                <option value="">Choose…</option>{EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Event title" htmlFor="eventTitle" error={fe.eventTitle} required><input id="eventTitle" name="eventTitle" className="input" placeholder="e.g. Priya & Arun wedding" defaultValue={init.eventTitle} /></Field>
            <Field label="Event date" htmlFor="eventDate" error={fe.eventDate} required><input id="eventDate" name="eventDate" type="date" min={today} className="input" defaultValue={init.eventDate} /></Field>
            <div className="grid2" style={{ gap: 8 }}>
              <Field label="Start time" htmlFor="startTime" error={fe.startTime}><input id="startTime" name="startTime" type="time" className="input" defaultValue={init.startTime} /></Field>
              <Field label="End time" htmlFor="endTime" error={fe.endTime}><input id="endTime" name="endTime" type="time" className="input" defaultValue={init.endTime} /></Field>
            </div>
            <Field label="Guests" htmlFor="guests" error={fe.guests}><input id="guests" name="guests" type="number" min={0} className="input" value={guests} onChange={e => setGuests(e.target.value)} /></Field>
            <div style={{ gridColumn: 'span 2' }}><Field label="Venue" htmlFor="venue" error={fe.venue} required><input id="venue" name="venue" className="input" placeholder="Hall name, area, city" defaultValue={init.venue} /></Field></div>
            <Field label="Valid until" htmlFor="validUntil" error={fe.validUntil} required><input id="validUntil" name="validUntil" type="date" min={today} className="input" defaultValue={init.validUntil} /></Field>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h"><h2>Items</h2>
            <select className="input" style={{ width: 240 }} value="" aria-label="Add a common item" onChange={e => {
              const p = PRESETS[Number(e.target.value)]; if (!p) return;
              add({ desc: p.desc, rate: String(p.rate), qty: p.perGuest && Number(guests) ? guests : '1' });
            }}>
              <option value="">+ Add a common item…</option>{PRESETS.map((p, i) => <option key={p.desc} value={i}>{p.desc} — {rupee(p.rate)}</option>)}
            </select>
          </div>
          <div className="tablewrap"><table className="items"><thead><tr><th style={{ width: '52%' }}>Description</th><th className="num" style={{ width: 100 }}>Qty</th><th className="num" style={{ width: 140 }}>Rate (₹)</th><th className="num">Amount</th><th style={{ width: 40 }} /></tr></thead>
            <tbody>{items.map((it, idx) => (
              <tr key={it.key}>
                <td><input className="input" aria-label={`Item ${idx + 1} description`} value={it.desc} onChange={e => update(it.key, { desc: e.target.value })} placeholder="What you will provide" /></td>
                <td><input className="input num" aria-label={`Item ${idx + 1} quantity`} type="number" min={0} step="any" value={it.qty} onChange={e => update(it.key, { qty: e.target.value })} /></td>
                <td><input className="input num" aria-label={`Item ${idx + 1} rate`} type="number" min={0} step="1" value={it.rate} onChange={e => update(it.key, { rate: e.target.value })} /></td>
                <td className="num">{rupee((Number(it.qty) || 0) * (Number(it.rate) || 0))}</td>
                <td><button type="button" className="iconbtn" aria-label={`Remove item ${idx + 1}`} disabled={items.length === 1} onClick={() => setItems(xs => xs.filter(x => x.key !== it.key))}>×</button></td>
              </tr>))}</tbody>
          </table></div>
          <div className="panel-b" style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', borderTop: '1px solid var(--line)' }}>
            <div><button type="button" className="btn sm" onClick={() => add()}>+ Add line</button>{fe.items && <div className="ferr" style={{ marginTop: 6 }} role="alert">{fe.items}</div>}</div>
            <div className="totals">
              <span>Subtotal</span><span className="num">{rupee(subtotal)}</span>
              <label htmlFor="discount">Discount (₹)</label><input id="discount" name="discount" type="number" min={0} className="input num" style={{ width: 120, height: 30 }} value={discount} onChange={e => setDiscount(e.target.value)} />
              <span className="grand">Total</span><span className="grand num">{rupee(subtotal - disc)}</span>
            </div>
          </div>
        </div>

        <div className="panel"><div className="panel-b">
          <Field label="Notes for the customer" htmlFor="notes" error={fe.notes} hint="Shown on the quotation and in the WhatsApp confirmation."><textarea id="notes" name="notes" rows={3} className="input" defaultValue={init.notes} /></Field>
        </div></div>
      </div>
      <div className="formfoot" style={{ position: 'sticky', bottom: 0 }}>
        <SubmitButton pending={pending} pendingText="Saving…">{init.id ? 'Save changes' : 'Save as draft'}</SubmitButton>
        <Link className="btn" href={init.id ? `/quotations/${init.id}` : '/quotations'}>Cancel</Link>
      </div>
    </form>
  );
}
