'use client';
import { useState } from 'react';
import { FormMessage, SubmitButton, useFormAction } from '@/components/ui';
import { saveServicesAction } from './actions';

type S = { key: string; name: string; unit: string; price: number; on: boolean; tools: string[] };
export function ServicesForm({ services }: { services: S[] }) {
  const { state, action, onSubmit, pending } = useFormAction(saveServicesAction);
  const [on, setOn] = useState<Record<string, boolean>>(Object.fromEntries(services.map(s => [s.key, s.on])));
  return (
    <form action={action} onSubmit={onSubmit}>
      <div className="body">
        <FormMessage state={state} />
        <div className="svcgrid">{services.map(s => (
          <div key={s.key} className={'svccard ' + (on[s.key] ? 'on' : 'off')}>
            <header><b>{s.name}</b>
              <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" name={`on_${s.key}`} checked={on[s.key]} onChange={e => setOn(o => ({ ...o, [s.key]: e.target.checked }))} />{on[s.key] ? 'Offered' : 'Not offered'}</label></header>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label className="small" htmlFor={`price_${s.key}`}>Price (₹)</label>
              <input id={`price_${s.key}`} name={`price_${s.key}`} type="number" min={0} step={10} className="input" style={{ width: 130 }} defaultValue={s.price} />
              <span className="small muted">{s.unit}</span>
            </div>
            {s.tools.length > 0 && <div className="small muted">Brings: {s.tools.join(', ')}</div>}
          </div>))}</div>
      </div>
      <div className="formfoot" style={{ position: 'sticky', bottom: 0 }}><SubmitButton pending={pending} pendingText="Saving…">Save services</SubmitButton></div>
    </form>
  );
}
