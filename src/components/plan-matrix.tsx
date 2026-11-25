import { PLANS, PLAN_MATRIX } from '@/lib/plans';

export function PlanMatrix({ current }: { current?: string }) {
  return (
    <div className="panel">
      <div className="panel-h"><div><h2>What each plan includes</h2></div></div>
      <div className="tablewrap"><table className="plans">
        <thead><tr><th>Feature</th>{(['basic', 'pro', 'enterprise'] as const).map(p => <th key={p} className={current === p ? 'cur' : ''}>{PLANS[p].name}{current === p && ' (yours)'}<div className="muted" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{PLANS[p].blurb}</div></th>)}</tr></thead>
        <tbody>{PLAN_MATRIX.map(r => <tr key={r[0]}><td><b>{r[0]}</b></td>{r.slice(1).map((v, i) => <td key={i}>{v === 'Yes' ? <span className="badge good">Included</span> : v === 'No' ? <span className="muted">Not included</span> : v}</td>)}</tr>)}</tbody>
      </table></div>
    </div>
  );
}
