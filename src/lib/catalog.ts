/** The services an event company can offer, with default prices. Pure data. */
export const CATALOG = [
  { key: 'photography', name: 'Photography', unit: 'per day', price: 35000 },
  { key: 'videography', name: 'Videography', unit: 'per day', price: 45000 },
  { key: 'editing', name: 'Photo and video editing', unit: 'per event', price: 15000 },
  { key: 'dj', name: 'DJ services', unit: 'per night', price: 40000 },
  { key: 'entertainment', name: 'Entertainment', unit: 'per show', price: 50000 },
  { key: 'dance', name: 'Dance performances', unit: 'per show', price: 30000 },
  { key: 'catering', name: 'Catering', unit: 'per plate', price: 450 },
  { key: 'stage', name: 'Stage decoration', unit: 'per event', price: 60000 },
  { key: 'floral', name: 'Floral decoration', unit: 'per event', price: 40000 },
  { key: 'wedding', name: 'Wedding planning', unit: 'per event', price: 75000 },
  { key: 'lighting', name: 'Lighting and sound', unit: 'per event', price: 55000 },
  { key: 'coordination', name: 'Event coordination', unit: 'per event', price: 25000 },
  { key: 'invitation', name: 'Invitation design', unit: 'per 100 cards', price: 8000 },
  { key: 'venue', name: 'Venue arrangements', unit: 'per event', price: 20000 },
  { key: 'makeup', name: 'Makeup and styling', unit: 'per person', price: 12000 },
] as const;
export type ServiceKey = (typeof CATALOG)[number]['key'];
export const SVC = Object.fromEntries(CATALOG.map(s => [s.key, s])) as Record<string, (typeof CATALOG)[number]>;

/** A company's services: catalogue merged with its own on/off switches and prices. New companies start with a sensible set. */
export const DEFAULT_ON = ['wedding', 'catering', 'stage', 'floral', 'photography', 'makeup'];
export function tenantServices(stored: Record<string, { on: boolean; price: number }> | null | undefined) {
  const s = stored ?? {};
  const fresh = Object.keys(s).length === 0;
  return CATALOG.map(c => ({ ...c, on: fresh ? DEFAULT_ON.includes(c.key) : Boolean(s[c.key]?.on), price: s[c.key]?.price ?? c.price }));
}

export const EVENT_TYPES = ['Wedding', 'Reception', 'Engagement', 'Valaikappu', 'Puberty ceremony', 'Birthday', 'Corporate', 'Concert', 'College fest', 'House warming', 'Other'];
export const EXP_CATS = ['Food', 'Decor', 'Staff', 'Transport', 'Rental', 'Other'];
export const PAY_KINDS = ['Advance', 'Installment', 'Final payment'];
export const PAY_MODES = ['Cash', 'UPI', 'Bank transfer', 'Cheque', 'Card'];
export const SWATCHES = ['#2266d6', '#6b4eff', '#c2410c', '#0f766e', '#be185d', '#a16207', '#15803d', '#7c2d12'];
export const DOC_STYLES: Record<string, [string, string]> = { classic: ['Classic', 'Clean, with a colour line'], modern: ['Modern colour band', 'Bold header in your colour'], elegant: ['Elegant centred', 'Centred, classic serif titles'] };
/** Statuses a booking can have. Bookings are always confirmed events: a quotation becomes a booking only when it is accepted. */
export const BASE_STATUSES = ['Confirmed', 'Completed', 'Cancelled'];
/** Older records that are not bookings (pre-booking enquiries and declined quotations). Never shown in Bookings. */
export const NOT_BOOKINGS = ['Enquiry', 'Declined'];
/** Events that are not going ahead: left out of calendars, money and crew lists. */
export const CLOSED = ['Cancelled', 'Declined'];

/** Indian number words for "amount in words" on documents. */
export function words(n: number): string {
  n = Math.round(n);
  if (n === 0) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x: number) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''));
  const three = (x: number) => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x));
  const out: string[] = [];
  const cr = Math.floor(n / 1e7); n %= 1e7;
  const lk = Math.floor(n / 1e5); n %= 1e5;
  const th = Math.floor(n / 1000); n %= 1000;
  if (cr) out.push(three(cr) + ' Crore');
  if (lk) out.push(two(lk) + ' Lakh');
  if (th) out.push(two(th) + ' Thousand');
  if (n) out.push(three(n));
  return out.join(' ');
}
export const amountWords = (n: number) => 'Rupees ' + words(n) + ' Only';

/** Indian financial year label for a date, e.g. 2026-11-14 -> "2026-27". */
export function fy(iso: string) { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); const st = m >= 4 ? y : y - 1; return `${st}-${String(st + 1).slice(2)}`; }

/** Totals with optional GST split equally into CGST and SGST. */
export function docTotals(items: { qty: number; rate: number }[], discount: number, gst: boolean, rate: number) {
  const subtotal = items.reduce((s, l) => s + Math.round((Number(l.qty) || 0) * (Number(l.rate) || 0)), 0);
  const disc = Math.min(Math.max(Math.round(discount || 0), 0), subtotal);
  const taxable = subtotal - disc;
  const half = gst ? Math.round((taxable * rate) / 200) : 0;
  return { subtotal, discount: disc, taxable, cgst: half, sgst: half, tax: half * 2, total: taxable + half * 2, halfRate: rate / 2 };
}
