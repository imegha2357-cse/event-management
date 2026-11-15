'use client';
import { useEffect, useRef, useState } from 'react';
import { Field, FormMessage, SubmitButton, useFormAction } from './ui';
import { recordPaymentAction } from '@/app/(app)/invoices/actions';

type Inv = { id: string; label: string; client: string; docNo: string; total: number; paid: number };
const rupee = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const KINDS = ['Advance', 'Installment', 'Final payment'];
const MODES = ['Cash', 'UPI', 'Bank transfer', 'Cheque', 'Card'];
const wa = (phone: string, text: string) => { let n = phone.replace(/\D/g, ''); if (n.length === 10) n = '91' + n; return `https://wa.me/${n}?text=${encodeURIComponent(text)}`; };

/** Record a payment with a live "before → after" preview. */
export function PaymentForm({ invoices, selected, today }: { invoices: Inv[]; selected?: string; today: string }) {
  const { state, action, onSubmit, pending } = useFormAction(recordPaymentAction);
  const fe = state?.fieldErrors ?? {};
  const [invId, setInvId] = useState(selected && invoices.some(i => i.id === selected) ? selected : invoices[0]?.id ?? '');
  const inv = invoices.find(i => i.id === invId);
  const bal = inv ? inv.total - inv.paid : 0;
  const [kind, setKind] = useState(inv && inv.paid === 0 ? 'Advance' : 'Installment');
  const [amount, setAmount] = useState(inv ? String(Math.min(bal, Math.round(inv.total / 4))) : '');
  const [mode, setMode] = useState('UPI');
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  if (!inv) return <div className="panel"><div className="empty"><b>Nothing to collect</b>Every invoice is fully paid.</div></div>;
  const add = Math.max(0, Math.min(Number(amount) || 0, bal));
  const after = inv.paid + add;
  const st = after >= inv.total ? 'Paid' : after > 0 ? 'Partly paid' : 'Unpaid';
  const receipt = state?.ok && state.data ? state.data as { phone: string; receipt: string } : null;
  return (
    <form ref={ref} action={action} onSubmit={onSubmit} noValidate className="panel">
      <input type="hidden" name="kind" value={kind} /><input type="hidden" name="mode" value={mode} />
      <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormMessage state={state} />
        {receipt && <a className="btn good" style={{ alignSelf: 'flex-start' }} href={wa(receipt.phone, receipt.receipt)} target="_blank" rel="noopener noreferrer">Send receipt on WhatsApp</a>}
        <Field label="Which event?" htmlFor="invoiceId" error={fe.invoiceId} hint={`Client: ${inv.client} · Invoice ${inv.docNo} · ${rupee(inv.total)}`}>
          <select id="invoiceId" name="invoiceId" className="input" value={invId} onChange={e => { setInvId(e.target.value); const n = invoices.find(i => i.id === e.target.value); if (n) { setAmount(String(Math.min(n.total - n.paid, Math.round(n.total / 4)))); setKind(n.paid === 0 ? 'Advance' : 'Installment'); } }}>
            {invoices.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select></Field>
        <div className="field"><span className="label">What kind of payment?</span><div className="choices">{KINDS.map(k => <button type="button" key={k} className={'choice' + (kind === k ? ' on' : '')} aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}</div></div>
        <div className="grid2">
          <Field label="Amount received (₹)" htmlFor="amount" error={fe.amount} required><input id="amount" name="amount" type="number" min={1} className="input" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
          <Field label="Date received" htmlFor="paidOn" error={fe.paidOn} required><input id="paidOn" name="paidOn" type="date" max={today} className="input" defaultValue={today} /></Field>
        </div>
        <div className="field"><span className="label">How did the client pay?</span><div className="choices">{MODES.map(k => <button type="button" key={k} className={'choice' + (mode === k ? ' on' : '')} aria-pressed={mode === k} onClick={() => setMode(k)}>{k}</button>)}</div></div>
        <Field label="Reference or note (optional)" htmlFor="reference"><input id="reference" name="reference" className="input" placeholder="e.g. UPI ref 4821 7365 0094" /></Field>
        <div className="livebox" aria-live="polite">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{inv.label.split(' · ')[0]} after this payment</b><span className={`badge ${st}`}>{st}</span></div>
          <div className="lrow"><span>Quote</span><b>{rupee(inv.total)}</b></div>
          <div className="lrow"><span>Money received</span><b>{rupee(inv.paid)} → {rupee(after)}</b></div>
          <div className="lrow"><span>Still pending</span><b>{rupee(bal)} → {rupee(inv.total - after)}</b></div>
          <div className="twobar"><i style={{ width: `${(inv.paid / inv.total) * 100}%` }} /><i className="add" style={{ width: `${(add / inv.total) * 100}%` }} /></div>
          <div className="lrow small muted"><span>Paid so far: {Math.round((inv.paid / inv.total) * 100)}% → {Math.round((after / inv.total) * 100)}%</span><span>Light colour = this payment</span></div>
        </div>
      </div>
      <div className="formfoot"><SubmitButton pending={pending} pendingText="Saving…">Save payment</SubmitButton></div>
    </form>
  );
}
