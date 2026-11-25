import { todayIST } from './util';

/** A date range for reports. Dates are YYYY-MM-DD, both ends included. */
export type Range = { from: string; to: string; label: string; preset: string };

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const monthEnd = (y: number, m: number) => iso(y, m + 1, 0);
const valid = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Ready-made periods, worked out from today's date in India. */
export function presets(today = todayIST()) {
  const y = +today.slice(0, 4), m = +today.slice(5, 7);
  const fyStart = m >= 4 ? y : y - 1;
  const [ly, lm] = m === 1 ? [y - 1, 12] : [y, m - 1];
  const q = Math.floor(((m + 8) % 12) / 3); // financial-year quarter 0..3 (Apr–Jun = 0)
  const qStartMonth = ((q * 3 + 3) % 12) + 1, qStartYear = qStartMonth >= 4 ? fyStart : fyStart + 1;
  return [
    { key: 'month', label: 'This month', from: iso(y, m, 1), to: monthEnd(y, m) },
    { key: 'lastmonth', label: 'Last month', from: iso(ly, lm, 1), to: monthEnd(ly, lm) },
    { key: 'quarter', label: 'This quarter', from: iso(qStartYear, qStartMonth, 1), to: monthEnd(qStartYear + (qStartMonth + 2 > 12 ? 1 : 0), ((qStartMonth + 1) % 12) + 1) },
    { key: 'fy', label: `This financial year (${fyStart}-${String(fyStart + 1).slice(2)})`, from: iso(fyStart, 4, 1), to: iso(fyStart + 1, 3, 31) },
    { key: 'lastfy', label: `Last financial year (${fyStart - 1}-${String(fyStart).slice(2)})`, from: iso(fyStart - 1, 4, 1), to: iso(fyStart, 3, 31) },
    { key: 'all', label: 'All time', from: '2000-01-01', to: '2099-12-31' },
  ];
}

/** Reads ?preset= or ?from=&to= from the address; defaults to this financial year. */
export function rangeFrom(sp: { preset?: string; from?: string; to?: string }, today = todayIST()): Range {
  const ps = presets(today);
  if (valid(sp.from) || valid(sp.to)) {
    let from = valid(sp.from) ? sp.from! : '2000-01-01', to = valid(sp.to) ? sp.to! : '2099-12-31';
    if (from > to) [from, to] = [to, from];
    return { from, to, preset: 'custom', label: '' };
  }
  const p = ps.find(x => x.key === sp.preset) ?? ps.find(x => x.key === 'fy')!;
  return { from: p.from, to: p.to, preset: p.key, label: p.label };
}

/** Whole days between two YYYY-MM-DD dates. */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
