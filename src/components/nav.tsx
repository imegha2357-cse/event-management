'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const I = {
  dash: 'M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z',
  cal: 'M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm-2 8h14v10H5z',
  book: 'M9 11l2 2 4-4M5 4h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  quote: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8',
  cust: 'M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0M12 7a3 3 0 1 0 0 .01',
  staff: 'M9 7a3 3 0 1 0 0 .01M17 9a2.5 2.5 0 1 0 0 .01M3 20a6 6 0 0 1 12 0M15 20a5 5 0 0 1 6-4.9',
  set: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.1V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};
const ITEMS: { group?: string; href: string; label: string; icon: keyof typeof I }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dash' },
  { group: 'Sales', href: '/quotations', label: 'Quotations', icon: 'quote' },
  { href: '/bookings', label: 'Bookings', icon: 'book' },
  { href: '/calendar', label: 'Calendar', icon: 'cal' },
  { href: '/customers', label: 'Customers', icon: 'cust' },
  { group: 'Operations', href: '/staff', label: 'Staff & crews', icon: 'staff' },
  { group: 'Company', href: '/settings', label: 'Settings', icon: 'set' },
];

export function SideNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main">
      {ITEMS.map(it => (
        <div key={it.href}>
          {it.group && <div className="group">{it.group}</div>}
          <Link href={it.href} className={'navlink' + (path === it.href || path.startsWith(it.href + '/') ? ' on' : '')} aria-current={path.startsWith(it.href) ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={I[it.icon]} /></svg>
            {it.label}
          </Link>
        </div>
      ))}
    </nav>
  );
}
