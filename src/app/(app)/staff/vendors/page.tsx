import { asc, eq, sql } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead, Empty } from '@/components/page';
import { Gate } from '@/components/locked';
import { ActionButton } from '@/components/action-form';
import { MiniForm } from '@/components/mini-form';
import { inr } from '@/lib/util';
import { addVendorAction, deleteVendorAction } from '../../settings/actions';
export const metadata = { title: 'Vendors' };

export default async function Vendors() {
  const ctx = await requireUser();
  const g = gate(ctx, 'vendors'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const V = schema.vendors, E = schema.expenses;
  const rows = await ctx.db.select({ v: V, spent: sql<number>`coalesce((select sum(e.amount) from expenses e where e.vendor_id = "vendors"."id"),0)::int` }).from(V).where(eq(V.tenantId, ctx.tenant.id)).orderBy(asc(V.name));
  return (<>
    <PageHead title="Vendors" sub="Flower, tent, sound and printing suppliers you hire. Pick a vendor when you add an expense to link the cost." />
    <div className="body">
      <div className="panel"><div className="panel-b"><MiniForm action={addVendorAction} submit="+ Add vendor"><div className="grid3">
        <div className="field"><label htmlFor="v-name">Name</label><input id="v-name" name="name" className="input" placeholder="e.g. Green Petal Flowers" /></div>
        <div className="field"><label htmlFor="v-cat">Supplies</label><input id="v-cat" name="category" className="input" placeholder="e.g. Flowers" /></div>
        <div className="field"><label htmlFor="v-phone">Phone</label><input id="v-phone" name="phone" className="input" /></div>
      </div><div className="field"><label htmlFor="v-notes">Notes</label><input id="v-notes" name="notes" className="input" /></div></MiniForm></div></div>
      <div className="panel">{rows.length === 0 ? <Empty title="No vendors added yet" /> : <table><thead><tr><th>Name</th><th>Supplies</th><th>Phone</th><th className="num">Paid so far</th><th /></tr></thead><tbody>
        {rows.map(({ v, spent }) => <tr key={v.id}><td><b>{v.name}</b><div className="small muted">{v.notes}</div></td><td>{v.category}</td><td>{v.phone}</td><td className="num">{inr(spent)}</td>
          <td className="num"><ActionButton action={deleteVendorAction} fields={{ rid: v.id }} label="Delete" className="btn sm danger" confirm={`Delete ${v.name}?`} /></td></tr>)}</tbody></table>}</div>
    </div>
  </>);
}
