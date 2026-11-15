import { requireUser, isPlatformAdmin } from '@/lib/session';
import { SideNav, SubTabs, type NavGroup } from '@/components/nav';
import { allowed, has, isEnt, moduleOf, pageModule, PLANS } from '@/lib/plans';
import { logoutAction } from '../(auth)/actions';

const SECTION: Record<string, string> = { dashboard: 'Main', calendar: 'Main', events: 'Workflow', quotations: 'Workflow', invoices: 'Workflow', payments: 'Workflow', customers: 'Management', services: 'Management', staff: 'Management', settings: 'System' };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireUser();
  const { user, tenant, groups, custom } = ctx;
  const hidden = isEnt(tenant) ? custom.hidden ?? [] : [];
  const nav: NavGroup[] = groups
    .filter(g => !hidden.includes(g.key) || ['dashboard', 'settings'].includes(g.key))
    .map(g => ({
      key: g.key, label: g.label, icon: g.icon, section: SECTION[g.key] ?? '',
      pages: g.pages.filter(p => allowed(tenant, user.role, p.module)).map(p => {
        const m = pageModule(p.module);
        return { href: p.href, label: p.label, lock: has(tenant, m) ? undefined : PLANS[moduleOf(m)!.plan].name };
      }),
    }))
    .filter(g => g.pages.length);
  const brand = (isEnt(tenant) && custom.colour) || tenant.colour || '#2266d6';
  const appName = (isEnt(tenant) && custom.appName) || 'EventDesk';
  const initials = user.name.split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="shell" style={{ ['--primary' as string]: brand, ['--primary-hover' as string]: `color-mix(in srgb, ${brand} 85%, black)`, ['--primary-soft' as string]: `color-mix(in srgb, ${brand} 12%, white)` }}>
      <aside className="side">
        <div className="side-brand">
          {tenant.logo ? <img src={tenant.logo} alt="" className="logoimg" /> : <div className="logo">{appName.slice(0, 2).toUpperCase()}</div>}
          <div><b>{appName}</b><span>{PLANS[ctx.plan].name} plan{tenant.city ? ` · ${tenant.city}` : ''}</span></div>
        </div>
        <SideNav groups={nav} admin={isPlatformAdmin(user)} />
        <div className="side-foot">Signed in as<br /><span style={{ color: '#fff' }}>{user.email}</span><br />{user.role}</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="org">{tenant.name}</span>
          <div className="usermenu">
            <span className="avatar" aria-hidden>{initials}</span>
            <span>{user.name}</span>
            <form action={logoutAction}><button className="btn sm" type="submit">Sign out</button></form>
          </div>
        </header>
        <div className="content"><SubTabs groups={nav} />{children}</div>
      </div>
    </div>
  );
}
