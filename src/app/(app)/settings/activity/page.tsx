import { desc, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead, Empty } from '@/components/page';
import { Gate } from '@/components/locked';
import { fmtDateTime } from '@/lib/util';
export const metadata = { title: 'Activity log' };

export default async function Activity() {
  const ctx = await requireUser();
  const g = gate(ctx, 'activity'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const rows = await ctx.db.select().from(schema.activityLog).where(eq(schema.activityLog.tenantId, ctx.tenant.id)).orderBy(desc(schema.activityLog.createdAt)).limit(300);
  return (<>
    <PageHead title="Activity log" sub="Every important change, who made it and when. Useful when many people and branches share one account." />
    <div className="body"><div className="panel">{rows.length === 0 ? <Empty title="Nothing yet">Changes you make will appear here.</Empty> : (
      <table><thead><tr><th>When</th><th>Who</th><th>What happened</th></tr></thead><tbody>
        {rows.map(r => <tr key={r.id}><td className="nowrap">{fmtDateTime(r.createdAt)}</td><td>{r.who}</td><td>{r.what}</td></tr>)}</tbody></table>)}</div></div>
  </>);
}
