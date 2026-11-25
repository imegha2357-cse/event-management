'use client';
import { useEffect, useRef, useState } from 'react';
import { Field, FormMessage, SubmitButton, useFormAction } from '@/components/ui';
import { addEmployeeAction, recordStaffPaymentAction } from '../actions';

function useDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  return { ref, open: () => ref.current?.showModal(), close: () => ref.current?.close() };
}

export function AddEmployeeButton({ leaders }: { leaders: { id: string; name: string }[] }) {
  const d = useDialog();
  const [kind, setKind] = useState<'permanent' | 'helper'>('permanent');
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <button type="button" className="btn primary" onClick={() => { setFormKey(k => k + 1); d.open(); }}>+ Add employee</button>
      <dialog ref={d.ref} aria-labelledby="add-emp-title">
        <EmployeeForm key={formKey} kind={kind} setKind={setKind} leaders={leaders} onDone={d.close} />
      </dialog>
    </>
  );
}

function EmployeeForm({ kind, setKind, leaders, onDone }: { kind: 'permanent' | 'helper'; setKind: (k: 'permanent' | 'helper') => void; leaders: { id: string; name: string }[]; onDone: () => void }) {
  const { state, action, onSubmit, pending } = useFormAction(addEmployeeAction);
  const fe = state?.fieldErrors ?? {};
  useEffect(() => { if (state?.ok) { const t = setTimeout(onDone, 900); return () => clearTimeout(t); } }, [state, onDone]);
  return (
    <form action={action} onSubmit={onSubmit} noValidate>
      <div className="dlg-h"><h2 id="add-emp-title">Add employee</h2><button type="button" className="iconbtn" aria-label="Close" onClick={onDone}>×</button></div>
      <div className="dlg-b">
        <FormMessage state={state} />
        <input type="hidden" name="kind" value={kind} />
        <div className="seg" role="radiogroup" aria-label="Employee type" style={{ alignSelf: 'flex-start' }}>
          <button type="button" role="radio" aria-checked={kind === 'permanent'} className={kind === 'permanent' ? 'on' : ''} onClick={() => setKind('permanent')}>Permanent employee</button>
          <button type="button" role="radio" aria-checked={kind === 'helper'} className={kind === 'helper' ? 'on' : ''} onClick={() => setKind('helper')}>Helper boy</button>
        </div>
        <div className="grid2">
          <Field label="Full name" htmlFor="emp-name" error={fe.name} required><input id="emp-name" name="name" className="input" autoComplete="off" /></Field>
          <Field label="Role (optional)" htmlFor="emp-role"><input id="emp-role" name="role" className="input" list="emp-roles" placeholder="e.g. Cook" /><datalist id="emp-roles">{['Crew leader', 'Cook', 'Server', 'Decorator', 'Photographer', 'Driver', 'Coordinator', 'Makeup artist', 'Stage crew lead'].map(r => <option key={r} value={r} />)}</datalist></Field>
        </div>
        <div className="grid2">
          <Field label="Phone number" htmlFor="emp-phone" error={fe.phone} required><input id="emp-phone" name="phone" className="input" inputMode="tel" placeholder="98765 43210" /></Field>
          <Field label="Daily wage (₹)" htmlFor="emp-wage" error={fe.dailyWage} required><input id="emp-wage" name="dailyWage" type="number" min={1} className="input" /></Field>
        </div>
        {kind === 'helper' && (
          <Field label="Brought by (permanent employee)" htmlFor="emp-leader" error={fe.leaderId} required hint={leaders.length ? undefined : 'Add a permanent employee first.'}>
            <select id="emp-leader" name="leaderId" className="input" defaultValue=""><option value="">Choose…</option>{leaders.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          </Field>
        )}
      </div>
      <div className="formfoot" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <SubmitButton pending={pending} pendingText="Saving…">Add employee</SubmitButton>
      </div>
    </form>
  );
}

export function PayButton({ staffId, name, balance, today, events = [] }: { staffId: string; name: string; balance: number; today: string; events?: [string, string][] }) {
  const d = useDialog();
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <button type="button" className="btn sm" onClick={() => { setFormKey(k => k + 1); d.open(); }}>Pay</button>
      <dialog ref={d.ref} aria-label={`Record payment to ${name}`}>
        <PayForm key={formKey} staffId={staffId} name={name} balance={balance} today={today} events={events} onDone={d.close} />
      </dialog>
    </>
  );
}

function PayForm({ staffId, name, balance, today, events, onDone }: { staffId: string; name: string; balance: number; today: string; events: [string, string][]; onDone: () => void }) {
  const { state, action, onSubmit, pending } = useFormAction(recordStaffPaymentAction);
  const fe = state?.fieldErrors ?? {};
  useEffect(() => { if (state?.ok) { const t = setTimeout(onDone, 900); return () => clearTimeout(t); } }, [state, onDone]);
  return (
    <form action={action} onSubmit={onSubmit} noValidate>
      <input type="hidden" name="staffId" value={staffId} />
      <div className="dlg-h"><h2>Pay {name}</h2><button type="button" className="iconbtn" aria-label="Close" onClick={onDone}>×</button></div>
      <div className="dlg-b">
        <FormMessage state={state} />
        <p className="small muted">Balance due: ₹{Math.max(balance, 0).toLocaleString('en-IN')}</p>
        <div className="grid2">
          <Field label="Amount (₹)" htmlFor={`amt-${staffId}`} error={fe.amount} required><input id={`amt-${staffId}`} name="amount" type="number" min={1} className="input" defaultValue={balance > 0 ? balance : ''} /></Field>
          <Field label="Paid on" htmlFor={`on-${staffId}`} error={fe.paidOn} required><input id={`on-${staffId}`} name="paidOn" type="date" max={today} className="input" defaultValue={today} /></Field>
        </div>
        {events.length > 0 && <Field label="For which event? (adds it to that event’s expenses)" htmlFor={`ev-${staffId}`}><select id={`ev-${staffId}`} name="bookingId" className="input" defaultValue=""><option value="">Not linked to an event</option>{events.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>}
        <Field label="Note" htmlFor={`note-${staffId}`} error={fe.note}><input id={`note-${staffId}`} name="note" className="input" placeholder="e.g. Cash, UPI" /></Field>
      </div>
      <div className="formfoot" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <SubmitButton pending={pending} pendingText="Saving…">Record payment</SubmitButton>
      </div>
    </form>
  );
}
