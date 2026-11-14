import { requireUser } from '@/lib/session';
import { SideNav } from '@/components/nav';
import { logoutAction } from '../(auth)/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant } = await requireUser();
  const initials = user.name.split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="shell">
      <aside className="side">
        <div className="side-brand"><div className="logo">ED</div><div><b>EventDesk</b><span>{tenant.city || 'Event management'}</span></div></div>
        <SideNav />
        <div className="side-foot">Signed in as<br /><span style={{ color: '#fff' }}>{user.email}</span></div>
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
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
