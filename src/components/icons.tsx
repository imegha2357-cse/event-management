/** Small line icons (24px grid). */
const P: Record<string, string> = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  calendar: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18',
  events: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8',
  quotations: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  invoices: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6M9 16h3',
  payments: 'M6 3h12M6 8h12M6 13h3a5 5 0 0 0 0-10M6 13l8 8',
  reports: 'M3 3v18h18M7 16v-4M12 16V8M17 16v-7',
  customers: 'M9 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3',
  services: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  team: 'M9 7a3 3 0 1 0 0 .01M17 9a2.5 2.5 0 1 0 0 .01M3 20a6 6 0 0 1 12 0M15 20a5 5 0 0 1 6-4.9',
  settings: 'M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M16 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM10 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM18 15.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  catering: 'M7 3v18M4 3v5a3 3 0 0 0 6 0V3M17 21V3c-2 1-3.5 3.5-3.5 7 0 1.5.8 2.5 3.5 2.5',
  decor: 'M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4zM18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
  photo: 'M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  ent: 'M9 18V5l12-2v13M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  planning: 'M5 4h14v17H5zM9 4V3h6v1M9 12l2 2 4-4',
  makeup: 'M9 21h6v-8H9zM10 13V8l4-3v8',
  invite: 'M3 5h18v14H3zM3 7l9 6 9-6',
  wand: 'M15 4V2M15 10V8M11 6h2M17 6h2M4 20 15 9',
  whatsapp: 'M21 12a9 9 0 0 1-13.4 7.9L3 21l1.2-4.4A9 9 0 1 1 21 12z',
  admin: 'M12 3l8 4v5c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V7z',
  check: 'M5 12.5l4.5 4.5L19 7',
  cross: 'M6 6l12 12M18 6 6 18',
  print: 'M6 9V3h12v6M3 9h18v8H3zM6 14h12v7H6z',
};
export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={P[name] ?? P.wand} /></svg>;
}
export const ICON_CHOICES = ['wand', 'makeup', 'decor', 'catering', 'photo', 'invite', 'planning', 'ent', 'team', 'calendar', 'services'];
