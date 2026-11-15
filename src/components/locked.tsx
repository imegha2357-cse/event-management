import { moduleOf, PLANS } from '@/lib/plans';
import { inr } from '@/lib/util';
import { PageHead } from './page';
import { ActionButton } from './action-form';
import { requestUpgradeAction } from '@/app/(app)/plan-actions';

/** Shown in place of a page the company's plan does not include. */
export function Locked({ module, tenantPlan }: { module: string; tenantPlan: string }) {
  const m = moduleOf(module)!;
  const p = PLANS[m.plan];
  return (
    <>
      <PageHead title={m.label} badge={<span className="badge info">{p.name} feature</span>} />
      <div className="body narrow">
        <div className="panel"><div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p>You are on the <b>{PLANS[tenantPlan as keyof typeof PLANS]?.name ?? 'Basic'}</b> plan. {m.label} comes with the <b>{p.name}</b> plan ({inr(p.price)} per month).</p>
          {m.pitch && <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>{m.pitch.map(x => <li key={x}>{x}</li>)}</ul>}
          <ActionButton action={requestUpgradeAction} fields={{ plan: m.plan }} label={`Request upgrade to ${p.name}`} pendingText="Sending…" className="btn primary" />
          <p className="small muted">Your request goes to the EventDesk team, who switch your plan. Your data stays exactly as it is.</p>
        </div></div>
      </div>
    </>
  );
}

export function NoAccess() {
  return (<div className="body narrow"><div className="panel"><div className="empty"><b>Not available for your role</b>Ask the owner of your company account to change your role in Team and roles.</div></div></div>);
}

/** Renders the right block when gate() refuses a page. */
export function Gate({ g, plan }: { g: { kind: 'plan'; module: string } | { kind: 'role' }; plan: string }) {
  return g.kind === 'plan' ? <Locked module={g.module} tenantPlan={plan} /> : <NoAccess />;
}
