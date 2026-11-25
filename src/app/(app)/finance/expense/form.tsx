'use client';
import { useEffect, useRef, useState } from 'react';
import { Field, FormMessage, SubmitButton, useFormAction } from '@/components/ui';
import { addExpenseAction } from '../actions';

type Ev = { id: string; label: string; received: number; spent: number };
const rupee = (n: number) => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n || 0)).toLocaleString('en-IN');
const CATS = ['Food', 'Decor', 'Staff', 'Transport', 'Rental', 'Other'];

/** Shrinks a photo in the browser so it can be stored with the expense (max 520 px). */
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, 520 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.7)); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    img.src = url;
  });
}

export function ExpenseForm({ events, selected, today, vendors }: { events: Ev[]; selected?: string; today: string; vendors: { id: string; name: string }[] }) {
  const { state, action, onSubmit, pending } = useFormAction(addExpenseAction);
  const fe = state?.fieldErrors ?? {};
  const [ev, setEv] = useState(selected && events.some(e => e.id === selected) ? selected : events[0]?.id ?? '');
  const [cat, setCat] = useState('Food');
  const [mode, setMode] = useState('UPI');
  const [amount, setAmount] = useState('');
  const [bill, setBill] = useState('');
  const [billErr, setBillErr] = useState('');
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) { ref.current?.reset(); setAmount(''); setBill(''); } }, [state]);
  const e = events.find(x => x.id === ev);
  const a = Math.max(0, Number(amount) || 0);
  if (!events.length) return <div className="panel"><div className="empty"><b>No events yet</b>Create a booking first.</div></div>;
  return (
    <form ref={ref} action={action} onSubmit={onSubmit} noValidate className="panel">
      <input type="hidden" name="category" value={cat} /><input type="hidden" name="mode" value={mode} /><input type="hidden" name="bill" value={bill} />
      <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormMessage state={state} />
        <Field label="Which event?" htmlFor="bookingId" error={fe.bookingId}><select id="bookingId" name="bookingId" className="input" value={ev} onChange={x => setEv(x.target.value)}>{events.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></Field>
        <div className="field"><span className="label">Category</span><div className="choices">{CATS.map(c => <button type="button" key={c} className={'choice' + (cat === c ? ' on' : '')} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div></div>
        <Field label="What was it for?" htmlFor="item" error={fe.item} required><input id="item" name="item" className="input" placeholder="e.g. 300 roses from the flower market" /></Field>
        <div className="grid2">
          <Field label="Amount (₹)" htmlFor="amount" error={fe.amount} required><input id="amount" name="amount" type="number" min={1} className="input" value={amount} onChange={x => setAmount(x.target.value)} placeholder="e.g. 12000" /></Field>
          <Field label="Date paid" htmlFor="spentOn" error={fe.spentOn} required><input id="spentOn" name="spentOn" type="date" max={today} className="input" defaultValue={today} /></Field>
        </div>
        <div className="grid2">
          <Field label="Paid to (optional)" htmlFor="paidTo"><input id="paidTo" name="paidTo" className="input" placeholder="e.g. Green Petal Flowers" /></Field>
          {vendors.length > 0 && <Field label="Vendor (optional)" htmlFor="vendorId"><select id="vendorId" name="vendorId" className="input"><option value="">None</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>}
        </div>
        <div className="field"><span className="label">How did you pay?</span><div className="choices">{['Cash', 'UPI', 'Bank transfer'].map(c => <button type="button" key={c} className={'choice' + (mode === c ? ' on' : '')} aria-pressed={mode === c} onClick={() => setMode(c)}>{c}</button>)}</div></div>
        <div className="field"><span className="label">Bill photo (optional)</span>
          {bill ? <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><img src={bill} alt="Bill photo preview" className="billthumb" /><button type="button" className="btn sm" onClick={() => setBill('')}>Remove photo</button></div>
            : <label className="dropzone">Tap to take a photo or upload the bill<input type="file" accept="image/*" capture="environment" onChange={async x => { const f = x.target.files?.[0]; if (!f) return; try { setBill(await shrink(f)); setBillErr(''); } catch { setBillErr('That file could not be read as a photo.'); } }} /></label>}
          {(billErr || fe.bill) && <span className="ferr">{billErr || fe.bill}</span>}
        </div>
        {e && <div className="livebox" aria-live="polite"><b>{e.label.split(' · ')[0]} after this expense</b>
          <div className="lrow"><span>Money received</span><b>{rupee(e.received)}</b></div>
          <div className="lrow"><span>Money spent</span><b>{rupee(e.spent)} → {rupee(e.spent + a)}</b></div>
          <div className="lrow"><span>Profit so far</span><b>{rupee(e.received - e.spent)} → {rupee(e.received - e.spent - a)}</b></div></div>}
      </div>
      <div className="formfoot"><SubmitButton pending={pending} pendingText="Saving…">Save expense</SubmitButton></div>
    </form>
  );
}
