import 'server-only';
import crypto from 'node:crypto';
import { and, eq, like, max, sql } from 'drizzle-orm';
import { schema } from '@/db';
import type { Ctx } from './session';
import { docTotals, fy } from './catalog';
import { docCfg } from './docs';
import { ensureSeeded, loadRows } from './tool-server';
import { addDays, randomToken, todayIST } from './util';

/** Every demo row id starts with this, so demo data can be removed without touching real data. */
const P = 'demo-';
const did = () => P + crypto.randomUUID();

const PEOPLE: [string, string, string][] = [
  ['Priya Kumar', '9876543210', 'Chennai'], ['Arun Prakash', '9840012345', 'Coimbatore'], ['Divya Ramesh', '9789012345', 'Madurai'], ['Karthik Subramanian', '9445012345', 'Salem'],
  ['Lakshmi Narayanan', '9600112233', 'Tiruchirappalli'], ['Senthil Murugan', '9884455667', 'Erode'], ['Meenakshi Sundaram', '9500123456', 'Thanjavur'], ['Rajesh Iyer', '9443322110', 'Chennai'],
  ['Kavitha Balaji', '9786543210', 'Vellore'], ['Vignesh Kumar', '9840098765', 'Tirunelveli'], ['Anitha Joseph', '9487012345', 'Kanyakumari'], ['Suresh Babu', '9362012345', 'Salem'],
  ['Nandhini Ravi', '9944012345', 'Coimbatore'], ['Gowtham Raj', '9003012345', 'Madurai'], ['Revathi Shankar', '9150012345', 'Chennai'],
];
const EVENTS: [string, string, string, number][] = [
  ['Wedding', 'Sree Mahal', 'wedding', 400], ['Reception', 'Grand Palace Hall', 'reception', 300], ['Engagement', 'Hotel Cenneys', 'engagement', 150], ['Birthday', 'Rainbow Party Hall', 'birthday', 80],
  ['Valaikappu', 'Lakshmi Kalyana Mandapam', 'valaikappu', 120], ['Puberty ceremony', 'Annai Mahal', 'function', 200], ['Corporate', 'Le Méridien', 'annual meet', 250], ['House warming', 'Residence', 'house warming', 60],
  ['Wedding', 'Kumaran Thirumana Mandapam', 'wedding', 500], ['Reception', 'Taj Coromandel', 'reception', 350], ['Engagement', 'GRT Convention Centre', 'engagement', 180], ['College fest', 'PSG College Auditorium', 'cultural fest', 600],
  ['Wedding', 'Vasantham Mahal', 'wedding', 450], ['Birthday', 'Fun City Hall', 'birthday', 100], ['Concert', 'Kamarajar Arangam', 'music night', 800],
];
// days from today: 8 finished events, 5 confirmed upcoming, 2 enquiries
const OFFSETS = [-120, -95, -80, -62, -45, -33, -20, -9, 6, 12, 19, 27, 40, 52, 70];
const EXP: [string, string, number][] = [['Food', 'Vegetables and groceries', 0.18], ['Decor', 'Flowers and stage material', 0.12], ['Staff', 'Serving staff wages', 0.08], ['Transport', 'Tempo and car hire', 0.03], ['Rental', 'Chairs and generator rent', 0.05]];
const VENDORS: [string, string, string][] = [
  ['Green Petal Flowers', 'Flowers', '9841011111'], ['Sri Murugan Tent House', 'Tents and shamiana', '9841022222'], ['Sound Wave Audio', 'Sound and lights', '9841033333'], ['Annai Printers', 'Invitation printing', '9841044444'],
  ['Thovalai Flower Market', 'Fresh flowers', '9841055555'], ['Royal Chair Rentals', 'Chairs and tables', '9841066666'], ['Kumar Generators', 'Generators', '9841077777'], ['Lakshmi Vessels', 'Cooking vessels', '9841088888'],
  ['Star Travels', 'Transport', '9841099999'], ['Ganesh Ice Supply', 'Ice and water cans', '9841000001'], ['Balloon World', 'Balloon decor', '9841000002'], ['Spice Traders', 'Masala and spices', '9841000003'],
  ['Fresh Veg Mandi', 'Vegetables', '9841000004'], ['Golden Lights', 'LED and fairy lights', '9841000005'], ['Sai Catering Supplies', 'Disposables', '9841000006'],
];
const LEADERS: [string, number, string][] = [['Murugan', 900, 'Crew leader'], ['Selvaraj', 850, 'Cook'], ['Benny', 900, 'Decorator'], ['Ajith', 1200, 'Photographer'], ['Karthikeyan', 800, 'Stage crew lead']];
const HELPERS = ['Ravi', 'Mani', 'Saravanan', 'Prakash', 'Dinesh', 'Gopi', 'Balu', 'Siva', 'Kannan', 'Vijay'];

export async function demoLoaded(ctx: Pick<Ctx, 'db' | 'tenant'>) {
  const [r] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(schema.customers).where(and(eq(schema.customers.tenantId, ctx.tenant.id), like(schema.customers.id, P + '%')));
  return (r?.n ?? 0) > 0;
}

/** Adds 15 sample entries to each main list of the signed-in company. */
export async function loadDemo(ctx: Ctx) {
  const { db, tenant } = ctx;
  const t = tenant.id, today = todayIST();
  const cfg = docCfg(tenant);
  const svc = ctx.services.filter(s => s.on);
  const pickSvc = (i: number) => [svc[i % svc.length], svc[(i + 2) % svc.length], svc[(i + 4) % svc.length]].filter((s, k, a) => s && a.findIndex(x => x.key === s.key) === k);

  // Customers
  const customers = PEOPLE.map(([name, phone, city], i) => ({ id: did(), tenantId: t, name, phone, city, email: `${name.split(' ')[0].toLowerCase()}${i + 1}@example.com` }));
  await db.insert(schema.customers).values(customers);

  // Bookings + quotations
  const [bm] = await db.select({ m: max(schema.bookings.number) }).from(schema.bookings).where(eq(schema.bookings.tenantId, t));
  const [qm] = await db.select({ m: max(schema.quotations.number) }).from(schema.quotations).where(eq(schema.quotations.tenantId, t));
  let bn = bm?.m ?? 0, qn = qm?.m ?? 0;
  const gst = Boolean(tenant.gstin);
  const bookings: (typeof schema.bookings.$inferInsert)[] = [], quotes: (typeof schema.quotations.$inferInsert)[] = [];
  EVENTS.forEach(([type, venue, word, guests], i) => {
    const c = customers[i], date = addDays(today, OFFSETS[i]);
    const status = i < 8 ? 'Completed' : i < 13 ? 'Confirmed' : 'Enquiry';
    const items = pickSvc(i).map(s => ({ desc: `${s.name} (${s.unit})`, qty: s.unit === 'per plate' ? guests : 1, rate: s.price }));
    const tot = docTotals(items, i % 3 === 0 ? 5000 : 0, gst, cfg.gstRate);
    const surname = c.name.split(' ').pop();
    const bid = did(), qid = did();
    bookings.push({ id: bid, tenantId: t, number: ++bn, customerId: c.id, title: `${surname} ${word}`, eventType: type, eventDate: date, setupTime: '10:00', startTime: i % 2 ? '18:00' : '09:00', endTime: i % 2 ? '23:00' : '14:00',
      venue: `${venue}, ${c.city}`, guests, services: pickSvc(i).map(s => s.key), status, crewNeeded: status === 'Confirmed' ? Math.ceil(guests / 25) : 0,
      items: status === 'Enquiry' ? [] : items, total: status === 'Enquiry' ? 0 : tot.total, quotationId: status === 'Enquiry' ? null : qid, notes: i === 0 ? 'Rose theme stage, live dessert counter' : '' });
    quotes.push({ id: qid, tenantId: t, number: ++qn, customerId: c.id, eventType: type, eventTitle: `${surname} ${word}`, eventDate: date, startTime: i % 2 ? '18:00' : '09:00', endTime: i % 2 ? '23:00' : '14:00',
      venue: `${venue}, ${c.city}`, guests, notes: '', items, discount: tot.discount, subtotal: tot.subtotal, tax: tot.tax, total: tot.total, gst, gstRate: cfg.gstRate,
      status: status === 'Enquiry' ? 'Sent' : 'Accepted', publicToken: randomToken(24), validUntil: addDays(today, 15), bookingId: status === 'Enquiry' ? bid : null,
      decidedAt: status === 'Enquiry' ? null : new Date(Date.parse(date) - 20 * 864e5), decidedBy: status === 'Enquiry' ? null : `${c.name} (customer)` });
  });
  await db.insert(schema.bookings).values(bookings.map(b => ({ ...b, quotationId: null })));
  await db.insert(schema.quotations).values(quotes);
  for (const b of bookings) if (b.quotationId) await db.update(schema.bookings).set({ quotationId: b.quotationId }).where(eq(schema.bookings.id, b.id!));
  await db.insert(schema.quotationEvents).values(quotes.flatMap(q => [
    { id: did(), tenantId: t, quotationId: q.id!, action: 'created', actor: ctx.user.name, note: 'Demo data' },
    { id: did(), tenantId: t, quotationId: q.id!, action: q.status === 'Accepted' ? 'accepted' : 'sent', actor: q.status === 'Accepted' ? q.decidedBy! : ctx.user.name, note: '' }]));

  // Invoices + payments for the 13 accepted events
  const invoices: (typeof schema.invoices.$inferInsert)[] = [], pays: (typeof schema.invoicePayments.$inferInsert)[] = [];
  const nextInv: Record<string, number> = {};
  for (const [i, b] of bookings.entries()) {
    if (!b.quotationId) continue;
    const q = quotes[i];
    const issued = addDays(b.eventDate, -15) < today ? addDays(b.eventDate, -15) : today;
    const year = fy(issued);
    if (nextInv[year] === undefined) { const [r] = await db.select({ m: max(schema.invoices.number) }).from(schema.invoices).where(and(eq(schema.invoices.tenantId, t), eq(schema.invoices.fy, year))); nextInv[year] = r?.m ?? 0; }
    const n = ++nextInv[year], id = did();
    invoices.push({ id, tenantId: t, fy: year, number: n, docNo: `${cfg.prefix}/${year}/${String(n).padStart(4, '0')}`, bookingId: b.id, quotationId: q.id, customerId: b.customerId, issuedOn: issued,
      items: q.items, discount: q.discount, gst: q.gst, gstRate: q.gstRate!, subtotal: q.subtotal, tax: q.tax, total: q.total });
    const total = q.total!;
    const adv = Math.round(total / 2);
    const advDate = addDays(issued, 0) <= today ? issued : today;
    if (i !== 12) pays.push({ id: did(), tenantId: t, invoiceId: id, amount: adv, kind: 'Advance', mode: ['UPI', 'Bank transfer', 'Cash'][i % 3], paidOn: advDate, reference: `UPI ref ${4821000 + i}` });
    if (i < 7) pays.push({ id: did(), tenantId: t, invoiceId: id, amount: total - adv, kind: 'Final payment', mode: 'Bank transfer', paidOn: addDays(b.eventDate, 2), reference: '' });
  }
  await db.insert(schema.invoices).values(invoices);
  if (pays.length) await db.insert(schema.invoicePayments).values(pays);

  // Vendors and expenses (15 each)
  const vendors = VENDORS.map(([name, category, phone]) => ({ id: did(), tenantId: t, name, category, phone, notes: '' }));
  await db.insert(schema.vendors).values(vendors);
  const done = bookings.filter(b => b.status === 'Completed');
  const expenses = Array.from({ length: 15 }, (_, k) => {
    const b = done[k % done.length], [category, item, share] = EXP[k % EXP.length];
    const v = vendors[k % vendors.length];
    return { id: did(), tenantId: t, bookingId: b.id, category, item, amount: Math.max(1500, Math.round(((b.total ?? 0) * share) / 100) * 100), spentOn: addDays(b.eventDate, -1), paidTo: v.name, vendorId: v.id, mode: k % 2 ? 'UPI' : 'Cash' };
  });
  await db.insert(schema.expenses).values(expenses);

  // Staff: 5 team leaders + 10 helper boys, crews on upcoming events, some wage payments
  const leaders = LEADERS.map(([name, wage, role], i) => ({ id: did(), tenantId: t, name, phone: `90000000${10 + i}`, kind: 'permanent', leaderId: null, dailyWage: wage, role }));
  const helpers = HELPERS.map((name, i) => ({ id: did(), tenantId: t, name, phone: `90000001${10 + i}`, kind: 'helper', leaderId: leaders[i % leaders.length].id, dailyWage: 600, role: '' }));
  await db.insert(schema.staff).values([...leaders, ...helpers]);
  const crew: (typeof schema.bookingCrew.$inferInsert)[] = [];
  [...bookings.slice(5, 8), ...bookings.slice(8, 10)].forEach((b, j) => {
    const l = leaders[j % leaders.length];
    for (const s of [l, ...helpers.filter(h => h.leaderId === l.id)]) crew.push({ id: did(), tenantId: t, bookingId: b.id!, staffId: s.id, present: b.status === 'Completed', wage: s.dailyWage });
  });
  await db.insert(schema.bookingCrew).values(crew);
  await db.insert(schema.staffPayments).values(leaders.slice(0, 3).map((l, i) => ({ id: did(), tenantId: t, staffId: l.id, amount: l.dailyWage, paidOn: addDays(today, -5 - i), note: 'Cash' })));

  // Service tools: 15 entries in each tool's main per-event list
  const upcoming = bookings.filter(b => b.status !== 'Completed');
  const evAt = (k: number) => upcoming[k % upcoming.length];
  for (const tool of ctx.tools.filter(x => !x.custom)) {
    await ensureSeeded(ctx, tool);
    const rows = await loadRows(ctx, tool.key);
    const ref = (coll: string, k: number) => { const xs = rows[coll] ?? []; return xs.length ? xs[k % xs.length].id : ''; };
    const add = (coll: string, make: (k: number, b: (typeof bookings)[number]) => Record<string, unknown>) =>
      db.insert(schema.toolRows).values(Array.from({ length: 15 }, (_, k) => { const b = evAt(k); return { id: did(), tenantId: t, tool: tool.key, coll, bookingId: b.id!, data: { eventId: b.id, created: today, ...make(k, b) } }; }));
    if (tool.key === 'catering') await add('menus', k => ({ plates: 0, dishes: [ref('dishes', k), ref('dishes', k + 2), ref('dishes', k + 3), ref('dishes', k + 10)].filter(Boolean) }));
    if (tool.key === 'decor') await add('plans', (k, b) => ({ design: ref('designs', k), setupDate: addDays(b.eventDate, -1), setupTime: '18:00', lead: LEADERS[k % 5][0], items: [{ ref: ref('items', k), qty: 2 + (k % 3) }], status: ['Planned', 'Setting up', 'Done'][k % 3] }));
    if (tool.key === 'photo') await add('shoots', k => ({ pkg: ref('packages', k), call: '06:00', crew: `${LEADERS[3][0]} + ${1 + (k % 3)} assistants`, coverage: ['Traditional and candid', 'Candid and drone', 'Traditional'][k % 3], status: ['Planned', 'Crew confirmed'][k % 2] }));
    if (tool.key === 'ent') await add('artists', k => ({ name: `Artist ${k + 1}`, act: ['DJ', 'Dance troupe', 'Singer', 'Anchor / emcee', 'Nadaswaram'][k % 5], fee: 15000 + (k % 5) * 5000, phone: `98410${77000 + k}` }));
    if (tool.key === 'planning') await add('tasks', (k, b) => ({ task: ['Confirm venue booking and advance', 'Finalise menu and plate count', 'Send invitations', 'Confirm flowers and tent', 'Share day-of timeline'][k % 5], owner: LEADERS[k % 5][0], due: addDays(b.eventDate, -(k % 5) * 7 - 3), status: ['To do', 'Doing', 'Done'][k % 3] }));
    if (tool.key === 'makeup') await add('bookings', k => ({ person: ['Bride', 'Groom', 'Bride’s mother', 'Bridesmaid', 'Groom’s sister'][k % 5], look: ref('looks', k), time: `0${4 + (k % 3)}:30`, artist: ['Nisha', 'Fathima', 'Keerthana'][k % 3], status: ['Confirmed', 'Trial done', 'Enquiry'][k % 3] }));
    if (tool.key === 'invite') await add('orders', (k, b) => ({ card: ref('cards', k), qty: 300 + k * 50, lang: ['Tamil', 'English', 'Tamil and English'][k % 3], due: addDays(b.eventDate, -21), stage: ['Design', 'Proof sent', 'Approved', 'Printing', 'Delivered'][k % 5] }));
  }

  await db.insert(schema.activityLog).values({ id: did(), tenantId: t, who: ctx.user.name, what: 'Loaded demo data (15 sample entries in each list)' });
}

/** Removes everything the demo loader added, plus anything later made for a demo customer. */
export async function removeDemo(ctx: Ctx) {
  const t = ctx.tenant.id;
  const run = (q: ReturnType<typeof sql>) => ctx.db.execute(q);
  const demo = (table: string) => run(sql`delete from ${sql.raw(table)} where tenant_id = ${t} and id like 'demo-%'`);
  await demo('tool_rows'); await demo('staff_payments'); await demo('booking_crew');
  await run(sql`delete from staff where tenant_id = ${t} and id like 'demo-%' and kind = 'helper'`); await demo('staff');
  await demo('expenses'); await demo('vendors'); await demo('invoice_payments');
  await run(sql`delete from invoices where tenant_id = ${t} and (id like 'demo-%' or customer_id like 'demo-%')`);
  await demo('quotation_events');
  await run(sql`update bookings set quotation_id = null where tenant_id = ${t} and customer_id like 'demo-%'`);
  await run(sql`delete from quotations where tenant_id = ${t} and (id like 'demo-%' or customer_id like 'demo-%')`);
  await run(sql`delete from bookings where tenant_id = ${t} and (id like 'demo-%' or customer_id like 'demo-%')`);
  await demo('customers'); await demo('activity_log');
}
