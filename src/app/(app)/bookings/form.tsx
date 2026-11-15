'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Field, FormMessage, SubmitButton, useFormAction } from '@/components/ui';
import { saveBookingAction } from './actions';

type CF = { id: string; label: string; type: string; options?: string[] };
const fmt = (s: string) => { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); return `${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]} ${y}`; };

export function CustomFieldInputs({ fields, values, prefix = 'cf_' }: { fields: CF[]; values?: Record<string, string>; prefix?: string }) {
  if (!fields.length) return null;
  return (<div className="grid3">{fields.map(f => (
    <Field key={f.id} label={f.label} htmlFor={prefix + f.id}>
      {f.type === 'select' ? <select id={prefix + f.id} name={prefix + f.id} className="input" defaultValue={values?.[f.id] ?? ''}><option value="">—</option>{(f.options ?? []).map(o => <option key={o}>{o}</option>)}</select>
        : <input id={prefix + f.id} name={prefix + f.id} className="input" type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} defaultValue={values?.[f.id] ?? ''} />}
    </Field>))}</div>);
}

export function BookingForm({ customers, services, eventTypes, taken, today, showCrew, branches, eventFields, defaultStatus }: {
  customers: { id: string; name: string; phone: string }[]; services: { key: string; name: string }[]; eventTypes: string[]; taken: { date: string; title: string }[];
  today: string; showCrew: boolean; branches: { id: string; name: string }[]; eventFields: CF[]; defaultStatus: 'Confirmed' | 'Enquiry';
}) {
  const { state, action, onSubmit, pending } = useFormAction(saveBookingAction);
  const fe = state?.fieldErrors ?? {};
  const [cust, setCust] = useState(customers.length ? '' : '__new');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState(defaultStatus);
  const [picked, setPicked] = useState<string[]>([]);
  const [crew, setCrew] = useState(10);
  const clash = taken.filter(t => t.date === date);
  return (
    <form action={action} onSubmit={onSubmit} noValidate>
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="crewNeeded" value={showCrew ? crew : 0} />
      <div className="body narrow">
        <FormMessage state={state} />
        <div className="panel"><div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field"><span className="label">What is this?</span>
            <div className="choices" role="radiogroup">
              {(['Confirmed', 'Enquiry'] as const).map(s => <button type="button" key={s} role="radio" aria-checked={status === s} className={'choice' + (status === s ? ' on' : '')} onClick={() => setStatus(s)}>{s === 'Confirmed' ? 'Confirmed booking' : 'Enquiry (not confirmed yet)'}</button>)}
            </div></div>
          <div className="grid3">
            <Field label="Customer" htmlFor="customerId" error={fe.customerId} required>
              <select id="customerId" name="customerId" className="input" value={cust} onChange={e => setCust(e.target.value)}>
                <option value="">Choose a customer…</option><option value="__new">+ New customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
              </select></Field>
            {cust === '__new' ? (<>
              <Field label="Customer name" htmlFor="newName" error={fe.newName} required><input id="newName" name="newName" className="input" placeholder="e.g. Rakesh Sharma" /></Field>
              <Field label="Mobile number" htmlFor="newPhone" error={fe.newPhone} required><input id="newPhone" name="newPhone" className="input" inputMode="tel" placeholder="98765 43210" /></Field>
            </>) : <><div /><div /></>}
            <Field label="Event type" htmlFor="eventType" error={fe.eventType} required><select id="eventType" name="eventType" className="input" defaultValue="Wedding">{eventTypes.map(t => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Event date" htmlFor="eventDate" error={fe.eventDate} required><input id="eventDate" name="eventDate" type="date" className="input" min={today} value={date} onChange={e => setDate(e.target.value)} /></Field>
            <Field label="Guests" htmlFor="guests" error={fe.guests}><input id="guests" name="guests" type="number" min={0} className="input" defaultValue={150} /></Field>
          </div>
          {date && (clash.length
            ? <div className="notice warn" role="status">{fmt(date)} already has {clash.map(c => c.title).join(', ')}. Check your crew and equipment.</div>
            : <div className="notice good" role="status">{fmt(date)} is free. No other event is booked that day.</div>)}
          <div className="grid3">
            <Field label="Setup from" htmlFor="setupTime"><input id="setupTime" name="setupTime" type="time" className="input" defaultValue="10:00" /></Field>
            <Field label="Event starts" htmlFor="startTime" error={fe.startTime}><input id="startTime" name="startTime" type="time" className="input" defaultValue="18:00" /></Field>
            <Field label="Event ends" htmlFor="endTime" error={fe.endTime}><input id="endTime" name="endTime" type="time" className="input" defaultValue="23:00" /></Field>
          </div>
          <div className="grid2">
            <Field label="Venue" htmlFor="venue" error={fe.venue}><input id="venue" name="venue" className="input" placeholder="e.g. Grand Palace Hall" /></Field>
            <Field label="Event name (optional)" htmlFor="title" hint="Leave empty to use “<surname> <event type>”."><input id="title" name="title" className="input" /></Field>
          </div>
          {services.length > 0 && <div className="field"><span className="label">Services needed</span><div className="choices">
            {services.map(s => { const on = picked.includes(s.key); return (
              <label key={s.key} className={'choice' + (on ? ' on' : '')}><input type="checkbox" name="services" value={s.key} checked={on} onChange={() => setPicked(p => on ? p.filter(x => x !== s.key) : [...p, s.key])} style={{ display: 'none' }} />{s.name}</label>); })}
          </div></div>}
          {showCrew && <div className="field"><span className="label">Staff needed</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" className="btn sm" aria-label="Fewer workers" onClick={() => setCrew(c => Math.max(0, c - 1))}>−</button><b style={{ minWidth: 30, textAlign: 'center' }}>{crew}</b>
              <button type="button" className="btn sm" aria-label="More workers" onClick={() => setCrew(c => Math.min(500, c + 1))}>+</button><span className="small muted">workers. Assign crew teams on the booking page.</span></div></div>}
          {branches.length > 0 && <Field label="Branch" htmlFor="branchId"><select id="branchId" name="branchId" className="input"><option value="">—</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>}
          <CustomFieldInputs fields={eventFields} />
          <Field label="Special notes (optional)" htmlFor="notes"><textarea id="notes" name="notes" rows={2} className="input" placeholder="e.g. Rose theme stage, cook to reach the hall by 2 PM" /></Field>
        </div>
        <div className="formfoot"><SubmitButton pending={pending} pendingText="Saving…">{status === 'Confirmed' ? 'Confirm booking' : 'Save enquiry'}</SubmitButton><Link href="/bookings" className="btn">Cancel</Link></div>
        </div>
      </div>
    </form>
  );
}
