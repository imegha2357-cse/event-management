'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icons';

export type NavPage = { href: string; label: string; lock?: string };
export type NavGroup = { key: string; label: string; icon: string; pages: NavPage[]; section: string };

/** Longest matching page href wins, so /finance/payment is not mistaken for /finance. */
export function activeHref(path: string, groups: NavGroup[]) {
  let best = '';
  for (const g of groups) for (const p of g.pages) if ((path === p.href || path.startsWith(p.href + '/')) && p.href.length > best.length) best = p.href;
  return best;
}

export function SideNav({ groups, admin }: { groups: NavGroup[]; admin: boolean }) {
  const path = usePathname();
  const cur = activeHref(path, groups);
  let last = '';
  return (
    <nav aria-label="Main">
      {groups.map(g => {
        const open = g.pages.find(p => !p.lock) ?? g.pages[0];
        const allLocked = g.pages.every(p => p.lock);
        const on = g.pages.some(p => p.href === cur);
        const head = g.section !== last ? <div className="group">{g.section}</div> : null;
        last = g.section;
        return (
          <div key={g.key}>
            {head}
            <Link href={open.href} className={'navlink' + (on ? ' on' : '') + (allLocked ? ' locked' : '')} aria-current={on ? 'page' : undefined}>
              <Icon name={g.icon} />
              <span style={{ flex: 1 }}>{g.label}</span>
              {allLocked ? <span className="navlock"><Icon name="lock" size={12} />{g.pages.some(p => p.lock === 'Pro') ? 'Pro' : g.pages[0].lock}</span> : g.pages.length > 1 ? <span className="navcount">{g.pages.length}</span> : null}
            </Link>
          </div>
        );
      })}
      {admin && (<><div className="group">Platform</div><Link href="/admin" className={'navlink' + (path.startsWith('/admin') ? ' on' : '')}><Icon name="admin" /><span>Admin panel</span></Link></>)}
    </nav>
  );
}

/** Tabs for the pages inside the current main menu item. */
export function SubTabs({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const cur = activeHref(path, groups);
  const g = groups.find(x => x.pages.some(p => p.href === cur));
  if (!g || g.pages.length < 2) return null;
  return (
    <nav className="subtabs" aria-label={`${g.label} sections`}>
      {g.pages.map(p => (
        <Link key={p.href} href={p.href} className={'subtab' + (p.href === cur ? ' on' : '')} aria-current={p.href === cur ? 'page' : undefined}>
          {p.lock && <Icon name="lock" size={12} />}{p.label}{p.lock && <span className="muted small"> {p.lock}</span>}
        </Link>
      ))}
    </nav>
  );
}
