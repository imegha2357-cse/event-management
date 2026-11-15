import type { schema } from '@/db';
import { isEnt, perk } from './plans';

type Tenant = typeof schema.tenants.$inferSelect;

export const prefixOf = (name: string) =>
  (name.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(w => w.length > 1).map(w => w[0]).join('').toUpperCase() + 'XXX').slice(0, 3);

/** Document settings: Enterprise companies can change titles, numbering, GST rate and sections in Customize. */
export function docCfg(t: Tenant) {
  const base = { quoteTitle: 'QUOTATION', invTitleGst: 'TAX INVOICE', invTitle: 'INVOICE', prefix: prefixOf(t.name), gstRate: 18, validDays: 15, words: true, sign: true };
  const c = isEnt(t) ? t.custom?.doc ?? {} : {};
  const merged = { ...base, ...Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined && v !== '')) } as typeof base;
  return {
    ...merged,
    style: perk(t, 'docDesigns') ? t.docStyle || 'classic' : 'classic',
    terms: (perk(t, 'docDesigns') && t.terms) || '',
    colour: (isEnt(t) && t.custom?.colour) || t.colour || '#2266d6',
  };
}
export const defaultTerms = (kind: 'quote' | 'invoice') =>
  kind === 'quote' ? 'An advance of 50% confirms your date. The balance is payable before the event.' : 'Thank you for choosing us. Please pay the balance before the event date.';

export function quoteLabel(t: Tenant, n: number) {
  return isEnt(t) && t.custom?.doc?.prefix ? `${t.custom.doc.prefix}-Q-${String(n).padStart(4, '0')}` : `QT-${String(n).padStart(5, '0')}`;
}
