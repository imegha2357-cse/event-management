'use client';
import { useFormAction } from '@/components/ui';
import { PLANS } from '@/lib/plans';
import { setPlanAction } from './actions';

/** Changing the select saves the plan immediately. */
export function PlanSelect({ tenantId, plan, name }: { tenantId: string; plan: string; name: string }) {
  const { state, action, onSubmit, pending } = useFormAction(setPlanAction);
  return (
    <form action={action} onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <select name="plan" className="input" defaultValue={plan} aria-label={`Plan for ${name}`} disabled={pending} style={{ height: 30, minWidth: 190 }}
        onChange={e => e.currentTarget.form?.requestSubmit()}>
        {Object.entries(PLANS).map(([k, p]) => <option key={k} value={k}>{p.name} (₹{p.price.toLocaleString('en-IN')}/mo)</option>)}
      </select>
      {state?.error && <span className="ferr">{state.error}</span>}
      {state?.ok && <span className="small" style={{ color: 'var(--good)' }}>Saved</span>}
    </form>
  );
}
