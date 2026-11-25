'use client';
import { useEffect, useRef, useState } from 'react';
import { Field, FormMessage, SubmitButton, useFormAction } from '@/components/ui';
import { addToolRowAction } from '../../actions';

export type RField = { f: string; label: string; type: string; req?: boolean; ph?: string; options?: [string, string][]; def?: string | number };

function Multi({ name, options }: { name: string; options: [string, string][] }) {
  const [on, setOn] = useState<string[]>([]);
  return (<div className="multi">{options.map(([v, l]) => (
    <label key={v} className={on.includes(v) ? 'on' : ''}><input type="checkbox" name={name} value={v} checked={on.includes(v)} onChange={() => setOn(x => x.includes(v) ? x.filter(y => y !== v) : [...x, v])} style={{ display: 'none' }} />{l}</label>))}</div>);
}
function Rows({ name, options }: { name: string; options: [string, string][] }) {
  const [n, setN] = useState(3);
  return (<div className="rowsfield">{Array.from({ length: n }, (_, i) => (
    <div className="r" key={i}><select name={`${name}_ref_${i}`} className="input" aria-label={`Item ${i + 1}`} defaultValue=""><option value="">None</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <input name={`${name}_qty_${i}`} type="number" min={0} step="any" className="input" style={{ width: 110 }} placeholder="Qty" aria-label={`Quantity ${i + 1}`} /></div>))}
    {n < 8 && <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setN(x => x + 1)}>+ Another</button>}</div>);
}

/** The "add a row" form for any tool list. */
export function ToolRowForm({ tool, coll, noun, add, fields }: { tool: string; coll: string; noun: string; add: string; fields: RField[] }) {
  const { state, action, onSubmit, pending } = useFormAction(addToolRowAction);
  const fe = state?.fieldErrors ?? {};
  const ref = useRef<HTMLFormElement>(null);
  const [k, setK] = useState(0);
  useEffect(() => { if (state?.ok) { ref.current?.reset(); setK(x => x + 1); } }, [state]);
  return (
    <details className="panel" open={!!state?.error}>
      <summary className="panel-h" style={{ cursor: 'pointer' }}><b>{add}</b></summary>
      <form key={k} ref={ref} action={action} onSubmit={onSubmit} noValidate>
        <input type="hidden" name="tool" value={tool} /><input type="hidden" name="coll" value={coll} />
        <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormMessage state={state} />
          <div className="grid3">{fields.filter(f => f.type !== 'multi' && f.type !== 'rows').map(f => (
            <Field key={f.f} label={f.label} htmlFor={'f_' + f.f} error={fe['f_' + f.f]} required={f.req}>
              {f.type === 'select' || f.type === 'event'
                ? <select id={'f_' + f.f} name={'f_' + f.f} className="input" defaultValue={String(f.def ?? '')}><option value="">{f.type === 'event' ? 'Choose an event…' : 'None'}</option>{(f.options ?? []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                : <input id={'f_' + f.f} name={'f_' + f.f} className="input" placeholder={f.ph} defaultValue={f.def === undefined ? undefined : String(f.def)}
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'} min={f.type === 'number' ? 0 : undefined} step={f.type === 'number' ? 'any' : undefined} />}
            </Field>))}</div>
          {fields.filter(f => f.type === 'multi' || f.type === 'rows').map(f => (
            <div className="field" key={f.f}><span className="label">{f.label}{f.req && <span className="req"> *</span>}</span>
              {f.type === 'multi' ? <Multi name={'f_' + f.f} options={f.options ?? []} /> : <Rows name={'f_' + f.f} options={f.options ?? []} />}
              {fe['f_' + f.f] && <span className="ferr">{fe['f_' + f.f]}</span>}</div>))}
        </div>
        <div className="formfoot"><SubmitButton pending={pending} pendingText="Saving…">Add {noun.toLowerCase()}</SubmitButton></div>
      </form>
    </details>
  );
}
