import { and, asc, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead } from '@/components/page';
import { Gate, NoAccess } from '@/components/locked';
import { ActionButton } from '@/components/action-form';
import { AutoSelect } from '@/components/auto-select';
import { MiniForm } from '@/components/mini-form';
import { DEFAULT_ROLES, LIMITS, PERM_KEYS, PERM_LABEL, has, isEnt, rolesOf } from '@/lib/plans';
import { addMemberAction, addRoleAction, deleteRoleAction, removeMemberAction, saveRolesAction, setMemberRoleAction } from '../../settings/actions';
export const metadata = { title: 'Team and roles' };

export default async function Team() {
  const ctx = await requireUser();
  const g = gate(ctx, 'team'); if (g) return <Gate g={g} plan={ctx.plan} />;
  if (ctx.user.role !== 'Owner') return <NoAccess />;
  const { db, tenant } = ctx;
  const users = await db.select().from(schema.users).where(and(eq(schema.users.tenantId, tenant.id), eq(schema.users.active, true))).orderBy(asc(schema.users.createdAt));
  const ent = isEnt(tenant);
  const roles = rolesOf(tenant);
  const lim = LIMITS[ctx.plan].users;
  const keys = PERM_KEYS.filter(k => k === 'tools' || has(tenant, k));
  return (<>
    <PageHead title="Team and roles" sub="Give each person their own login. What they can open depends on their role, so your accountant never sees the kitchen and your staff never see the money." />
    <div className="body">
      <div className="panel"><div className="panel-h"><h2>People</h2><span className="small muted">{users.length} of {lim === Infinity ? 'unlimited' : lim} logins used</span></div>
        <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead><tbody>
          {users.map(u => <tr key={u.id}><td><b>{u.name}</b><div className="small muted">{u.phone}</div></td><td>{u.email}</td>
            <td>{u.role === 'Owner' ? <span className="badge info">Owner</span> : <AutoSelect action={setMemberRoleAction} fields={{ rid: u.id }} name="role" value={u.role} options={roles.map(r => r.name)} label={`Role for ${u.name}`} />}</td>
            <td className="num">{u.role === 'Owner' ? <span className="small muted">Sees everything</span> : <ActionButton action={removeMemberAction} fields={{ rid: u.id }} label="Remove" className="btn sm danger" confirm={`Remove ${u.name}’s login? They will no longer be able to sign in.`} />}</td></tr>)}
        </tbody></table>
        {users.length < lim ? <div className="panel-b" style={{ borderTop: '1px solid var(--line)' }}><h3 style={{ marginBottom: 10 }}>Add a team member</h3>
          <MiniForm action={addMemberAction} submit="Add team member"><div className="grid3">
            <div className="field"><label htmlFor="m-name">Name</label><input id="m-name" name="name" className="input" /></div>
            <div className="field"><label htmlFor="m-email">Email (their login)</label><input id="m-email" name="email" type="email" className="input" /></div>
            <div className="field"><label htmlFor="m-phone">Phone (optional)</label><input id="m-phone" name="phone" className="input" /></div>
            <div className="field"><label htmlFor="m-role">Role</label><select id="m-role" name="role" className="input">{roles.map(r => <option key={r.name}>{r.name}</option>)}</select></div>
            <div className="field"><label htmlFor="m-pw">Temporary password</label><input id="m-pw" name="password" type="text" className="input" autoComplete="new-password" placeholder="At least 8 characters, with a number" /></div>
          </div></MiniForm></div>
          : <div className="panel-b notice" style={{ margin: 12 }}>You have used all {lim} logins on your plan. Ask for an upgrade in Settings → Plan.</div>}
      </div>
      <div className="panel"><div className="panel-h"><div><h2>What each role can open</h2><div className="small muted">{ent ? 'Tick or untick to change a role. Add your own roles, such as Kitchen head or Branch manager.' : 'Pro comes with these ready roles. Enterprise lets you change them and create your own.'}</div></div></div>
        {ent ? <div className="panel-b"><MiniForm action={saveRolesAction} submit="Save roles" reset={false}>
          <div className="tablewrap"><table className="perm"><thead><tr><th>Can open</th><th>Owner</th>{roles.map(r => <th key={r.name}>{r.name}</th>)}</tr></thead><tbody>
            {keys.map(k => <tr key={k}><td>{PERM_LABEL[k]}</td><td><span className="badge good">Always</span></td>{roles.map((r, i) => <td key={r.name}><input type="checkbox" name={`p_${i}_${k}`} defaultChecked={r.perms.includes(k)} aria-label={`${r.name} can open ${PERM_LABEL[k]}`} /></td>)}</tr>)}
          </tbody></table></div></MiniForm>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <MiniForm action={addRoleAction} submit="Add role" className="btn" style={{ flexDirection: 'row', alignItems: 'flex-end' }}><div className="field"><label htmlFor="r-name">New role</label><input id="r-name" name="name" className="input" placeholder="e.g. Branch manager" /></div></MiniForm>
            {roles.filter(r => !DEFAULT_ROLES.some(d => d.name === r.name)).map(r => <ActionButton key={r.name} action={deleteRoleAction} fields={{ name: r.name }} label={`Delete “${r.name}”`} className="btn sm danger" />)}
          </div></div>
          : <div className="tablewrap"><table className="perm"><thead><tr><th>Can open</th><th>Owner</th>{roles.map(r => <th key={r.name}>{r.name}</th>)}</tr></thead><tbody>
            {keys.map(k => <tr key={k}><td>{PERM_LABEL[k]}</td><td><span className="badge good">Always</span></td>{roles.map(r => <td key={r.name}>{r.perms.includes(k) ? <span className="badge good">Yes</span> : <span className="muted">—</span>}</td>)}</tr>)}
          </tbody></table></div>}
      </div>
    </div>
  </>);
}
