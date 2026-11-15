import { asc, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead } from '@/components/page';
import { Gate } from '@/components/locked';
import { moneyByBooking } from '@/lib/money';
import { has } from '@/lib/plans';
import { fmtDate, todayIST } from '@/lib/util';
import { ExpenseForm } from './form';
export const metadata = { title: 'Add expense' };

export default async function AddExpense({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireUser();
  const g = gate(ctx, 'payments'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const today = todayIST();
  const bs = await ctx.db.select().from(schema.bookings).where(eq(schema.bookings.tenantId, ctx.tenant.id));
  const money = await moneyByBooking(ctx);
  const sorted = bs.filter(b => b.status !== 'Cancelled').sort((a, b) => Math.abs(Date.parse(a.eventDate) - Date.parse(today)) - Math.abs(Date.parse(b.eventDate) - Date.parse(today)));
  const vendors = has(ctx.tenant, 'vendors') ? await ctx.db.select({ id: schema.vendors.id, name: schema.vendors.name }).from(schema.vendors).where(eq(schema.vendors.tenantId, ctx.tenant.id)).orderBy(asc(schema.vendors.name)) : [];
  return (<>
    <PageHead title="Add expense" sub="Record what an event cost you. Its profit updates straight away." />
    <div className="body narrow"><ExpenseForm today={today} selected={sp.booking} vendors={vendors}
      events={sorted.map(b => ({ id: b.id, label: `${b.title} · ${fmtDate(b.eventDate)}`, received: money.get(b.id)?.received ?? 0, spent: money.get(b.id)?.spent ?? 0 }))} /></div>
  </>);
}
