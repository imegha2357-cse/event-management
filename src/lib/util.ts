import crypto from 'node:crypto';
import type { LineItem } from '@/db/schema';

export const newId = () => crypto.randomUUID();
export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export const inr = (n: number) => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n || 0)).toLocaleString('en-IN');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Formats a YYYY-MM-DD date (or Date) as "14 Nov 2026" without timezone shifts. */
export function fmtDate(v: string | Date | null | undefined) {
  if (!v) return '';
  if (v instanceof Date) return v.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const [y, m, d] = v.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function fmtDateTime(v: Date | string | null | undefined) {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : v;
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}
export function fmtTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
}
/** Today's date in India as YYYY-MM-DD. */
export function todayIST() {
  return new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function quoteTotals(items: LineItem[], discount: number) {
  const subtotal = items.reduce((s, l) => s + Math.round((Number(l.qty) || 0) * (Number(l.rate) || 0)), 0);
  const disc = Math.min(Math.max(Math.round(discount || 0), 0), subtotal);
  return { subtotal, discount: disc, total: subtotal - disc };
}
export const quoteNo = (n: number) => `QT-${String(n).padStart(5, '0')}`;
export const bookingNo = (n: number) => `BK-${String(n).padStart(5, '0')}`;
/** Indian mobile numbers -> E.164 digits for WhatsApp (e.g. 9876543210 -> 919876543210). */
export function waNumber(phone: string) {
  let n = (phone || '').replace(/\D/g, '');
  if (n.length === 11 && n.startsWith('0')) n = n.slice(1);
  if (n.length === 10) n = '91' + n;
  return n;
}
