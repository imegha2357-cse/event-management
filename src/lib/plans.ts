/**
 * Plans, features, roles and the sidebar layout.
 * Pure data and functions: safe to import from server and client code.
 */
import type { Role, TenantCustom } from '@/db/schema';

export type PlanKey = 'basic' | 'pro' | 'enterprise';
export const PLANS: Record<PlanKey, { name: string; price: number; blurb: string }> = {
  basic: { name: 'Basic', price: 799, blurb: 'Small and new businesses' },
  pro: { name: 'Pro', price: 1999, blurb: 'Growing businesses' },
  enterprise: { name: 'Enterprise', price: 4999, blurb: 'Large, established companies' },
};
export const RANK: Record<PlanKey, number> = { basic: 0, pro: 1, enterprise: 2 };
export const planKey = (p: string): PlanKey => (p === 'pro' || p === 'enterprise' ? p : 'basic');

/** Each feature (module) and the lowest plan that includes it. */
export const MODULES: { key: string; label: string; plan: PlanKey; pitch?: string[] }[] = [
  { key: 'dashboard', label: 'Dashboard', plan: 'basic' },
  { key: 'events', label: 'Bookings', plan: 'basic' },
  { key: 'customers', label: 'Customers', plan: 'basic' },
  { key: 'quotations', label: 'Quotations', plan: 'basic' },
  { key: 'invoices', label: 'Invoices', plan: 'basic' },
  { key: 'services', label: 'My services', plan: 'basic' },
  { key: 'payments', label: 'Finance', plan: 'pro', pitch: ['See who owes you money, and how much, at a glance', 'Record advances and installments with a live before-and-after view', 'Add expenses with a photo of the bill', 'Compare events side by side to see which earned the most', 'Monthly income vs spending chart'] },
  { key: 'calendar', label: 'Calendar', plan: 'pro', pitch: ['Month view of every booked event', 'Spot busy dates and double bookings early', 'Enquiries and confirmed events shown in different colours'] },
  { key: 'reports', label: 'Expenses & profit', plan: 'pro', pitch: ['Record what each event cost you', 'See profit per event automatically', 'Totals for invoiced, collected and spent'] },
  { key: 'staff', label: 'Staff and crews', plan: 'pro', pitch: ['Plan the crew for every event: each crew leader and the boys they bring', 'Mark attendance on the day', 'Track salary due, paid and pending per team', 'Salary payments are added to the event’s expenses automatically'] },
  { key: 'team', label: 'Team and roles', plan: 'pro', pitch: ['Give your manager, accountant and staff their own logins', 'Each person sees only what their role allows', 'Pro: up to 5 logins with ready roles. Enterprise: unlimited logins and your own roles'] },
  { key: 'vendors', label: 'Vendors', plan: 'enterprise', pitch: ['Keep your flower, tent, sound and printing suppliers in one place', 'Link vendor costs to events'] },
  { key: 'customize', label: 'Customize', plan: 'enterprise', pitch: ['Your own app name and any brand colour', 'Rename or hide menu items', 'Add your own fields (like Nakshatram or Muhurtham time) and event statuses', 'Design quotation and invoice titles, numbering, GST rate and sections', 'Build your own tools, such as Mehendi bookings or Return gifts', 'Create roles and choose what each one can see', 'Add branches'] },
  { key: 'activity', label: 'Activity log', plan: 'enterprise', pitch: ['See who created, changed or deleted anything, and when', 'Useful when several branches and many staff work in one account'] },
  { key: 'settings', label: 'Company settings', plan: 'basic' },
];
export const moduleOf = (key: string) => MODULES.find(m => m.key === key);

export const LIMITS: Record<PlanKey, { events: number; users: number }> = {
  basic: { events: 10, users: 1 },
  pro: { events: Infinity, users: 5 },
  enterprise: { events: Infinity, users: Infinity },
};

/** Smaller per-plan switches inside features. */
export const PERKS = {
  whatsappShare: 'pro', // share quotation/invoice on WhatsApp, payment reminders and receipts
  paymentTracking: 'pro', // record advances/installments (Basic can only mark an invoice fully paid)
  docDesigns: 'pro', // 3 document designs + own terms
  customDocs: 'enterprise', // titles, numbering, GST rate, sections
  anyColour: 'enterprise',
  customTools: 'enterprise',
  customRoles: 'enterprise',
} as const satisfies Record<string, PlanKey>;

type T = { plan: string; custom?: TenantCustom | null };
export const atLeast = (t: T, p: PlanKey) => RANK[planKey(t.plan)] >= RANK[p];
export const has = (t: T, moduleKey: string) => { const m = moduleOf(moduleKey); return !m || atLeast(t, m.plan); };
export const perk = (t: T, k: keyof typeof PERKS) => atLeast(t, PERKS[k]);
export const isEnt = (t: T) => planKey(t.plan) === 'enterprise';

export const PLAN_MATRIX: [string, string, string, string][] = [
  ['Monthly price', '₹799', '₹1,999', '₹4,999'],
  ['Active events at a time', 'Up to 10', 'Unlimited', 'Unlimited'],
  ['Team logins', 'Owner only', 'Up to 5', 'Unlimited'],
  ['Quotations and GST invoices (print / PDF)', 'Yes', 'Yes', 'Yes'],
  ['Customer accepts quotation online, booking created automatically', 'Yes', 'Yes', 'Yes'],
  ['Quotation and invoice design', '1 standard design', '3 designs + your own terms', 'Fully custom: titles, numbering, GST rate, sections'],
  ['WhatsApp sharing, payment reminders and receipts', '—', 'Yes', 'Yes'],
  ['Advance and balance payment tracking', 'Mark as paid only', 'Yes', 'Yes'],
  ['Dashboard with notifications and calendar', 'Yes', 'Yes', 'Yes'],
  ['New quotation and booking forms (with date check)', 'Yes', 'Yes', 'Yes'],
  ['Calendar', '—', 'Yes', 'Yes'],
  ['Expenses and profit per event', '—', 'Yes', 'Yes'],
  ['Service tools (catering, decoration, photo…)', 'Core tools', 'All tools: purchase lists, stock, deliverables, run sheets', 'All tools + build your own'],
  ['Roles and permissions', '—', 'Ready roles: Manager, Accountant, Staff', 'Create roles and choose what each sees'],
  ['Staff crews, attendance and salary', '—', 'Yes', 'Yes'],
  ['Finance hub: record payments, expenses with bill photo, compare events', '—', 'Yes', 'Yes'],
  ['Vendors', '—', '—', 'Yes'],
  ['Multiple branches', '—', '—', 'Yes'],
  ['Custom fields and event statuses', '—', '—', 'Yes'],
  ['Rename or hide menu items', '—', '—', 'Yes'],
  ['App name and brand colour', 'Logo + 8 colours', 'Logo + 8 colours', 'Own app name, any colour'],
  ['Activity log (who changed what)', '—', '—', 'Yes'],
  ['Support', 'Email', 'Priority WhatsApp', 'Dedicated account manager'],
];

/* ---------------- Roles and permissions ---------------- */
export const PERM_KEYS = ['calendar', 'events', 'quotations', 'invoices', 'payments', 'reports', 'customers', 'services', 'staff', 'vendors', 'tools'] as const;
export const PERM_LABEL: Record<string, string> = { calendar: 'Calendar', events: 'Bookings', quotations: 'Quotations', invoices: 'Invoices', payments: 'Finance (payments)', reports: 'Expenses & profit', customers: 'Customers', services: 'My services', staff: 'Staff', vendors: 'Vendors', tools: 'Service tools' };
/** Pages only the owner can open. */
export const OWNER_ONLY = ['team', 'activity', 'customize', 'settings'];
export const DEFAULT_ROLES: Role[] = [
  { name: 'Manager', perms: ['calendar', 'events', 'quotations', 'invoices', 'customers', 'services', 'staff', 'vendors', 'tools'] },
  { name: 'Accountant', perms: ['quotations', 'invoices', 'payments', 'reports', 'customers'] },
  { name: 'Staff', perms: ['calendar', 'events', 'tools'] },
];
export const rolesOf = (t: T): Role[] => (isEnt(t) && t.custom?.roles?.length ? t.custom.roles : DEFAULT_ROLES);

/** Can this user open this module? The owner can open everything. */
export function allowed(t: T, role: string, key: string) {
  if (role === 'Owner' || key === 'dashboard') return true;
  if (OWNER_ONLY.includes(key)) return false;
  const r = rolesOf(t).find(x => x.name === role);
  if (!r) return false;
  return key.startsWith('tool:') ? r.perms.includes('tools') : r.perms.includes(key);
}

/* ---------------- Sidebar: at most 10 main items, everything else as tabs inside ---------------- */
export type Page = { href: string; label: string; module: string };
export type Group = { key: string; label: string; icon: string; pages: Page[] };
export const GROUP_LABEL: Record<string, string> = { dashboard: 'Dashboard', calendar: 'Calendar', events: 'Bookings', quotations: 'Quotations', invoices: 'Invoices', payments: 'Finance', customers: 'Customers', services: 'Services', staff: 'Staff & team', settings: 'Settings' };

export function groupsFor(tools: { key: string; label: string }[]): Group[] {
  return [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', pages: [{ href: '/dashboard', label: 'Overview', module: 'dashboard' }] },
    { key: 'calendar', label: 'Calendar', icon: 'calendar', pages: [{ href: '/calendar', label: 'Month view', module: 'calendar' }] },
    { key: 'events', label: 'Bookings', icon: 'events', pages: [{ href: '/bookings', label: 'All bookings', module: 'events' }, { href: '/bookings/new', label: 'New booking', module: 'events' }] },
    { key: 'quotations', label: 'Quotations', icon: 'quotations', pages: [{ href: '/quotations', label: 'All quotations', module: 'quotations' }, { href: '/quotations/new', label: 'New quotation', module: 'quotations' }] },
    { key: 'invoices', label: 'Invoices', icon: 'invoices', pages: [{ href: '/invoices', label: 'All invoices', module: 'invoices' }] },
    { key: 'payments', label: 'Finance', icon: 'payments', pages: [
      { href: '/finance', label: 'Overview', module: 'payments' }, { href: '/finance/payment', label: 'Record payment', module: 'payments' },
      { href: '/finance/expense', label: 'Add expense', module: 'payments' }, { href: '/finance/profit', label: 'Expenses & profit', module: 'reports' },
      { href: '/finance/compare', label: 'Compare events', module: 'payments' }] },
    { key: 'customers', label: 'Customers', icon: 'customers', pages: [{ href: '/customers', label: 'All customers', module: 'customers' }] },
    { key: 'services', label: 'Services', icon: 'services', pages: [{ href: '/services', label: 'My services', module: 'services' }, ...tools.map(x => ({ href: `/services/tools/${x.key}`, label: x.label, module: `tool:${x.key}` }))] },
    { key: 'staff', label: 'Staff & team', icon: 'team', pages: [{ href: '/staff', label: 'Staff and crews', module: 'staff' }, { href: '/staff/team', label: 'Team and roles', module: 'team' }, { href: '/staff/vendors', label: 'Vendors', module: 'vendors' }] },
    { key: 'settings', label: 'Settings', icon: 'settings', pages: [
      { href: '/settings', label: 'Company settings', module: 'settings' }, { href: '/settings/plan', label: 'Plan', module: 'settings' },
      { href: '/settings/customize', label: 'Customize', module: 'customize' }, { href: '/settings/activity', label: 'Activity log', module: 'activity' }] },
  ];
}
export const pageModule = (m: string) => (m.startsWith('tool:') ? 'services' : m);
