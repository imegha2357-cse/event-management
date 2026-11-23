import { and, eq, gte, notInArray } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead } from '@/components/page';
import { Gate } from '@/components/locked';
import { has, isEnt, LIMITS } from '@/lib/plans';
import { activeEventCount } from '@/lib/money';
import { quoteFormData } from '@/lib/form-data';
import { todayIST } from '@/lib/util';
import { BookingForm } from '../form';
import Link from 'next/link';
export const metadata = { title: 'New booking' };

export default async function NewBooking() {
  const ctx = await requireUser();
  const g = gate(ctx, 'events'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const today = todayIST();
  const lim = LIMITS[ctx.plan].events;
  if (lim !== Infinity && (await activeEventCount(ctx)) >= lim) return (<><PageHead title="New booking" /><div className="body narrow"><div className="formerror">
    The Basic plan allows {lim} active events at a time. Mark finished events as Completed, or <Link href="/settings/plan">ask for an upgrade</Link>.</div></div></>);
  const { customers, eventTypes } = await quoteFormData(ctx);
  const taken = await ctx.db.select({ date: schema.bookings.eventDate, title: schema.bookings.title }).from(schema.bookings)
    .where(and(eq(schema.bookings.tenantId, ctx.tenant.id), gte(schema.bookings.eventDate, today), notInArray(schema.bookings.status, ['Completed', 'Cancelled', 'Declined', 'Enquiry'])));
  const ent = isEnt(ctx.tenant);
  return (<>
    <PageHead title="New booking" sub="For a confirmed event agreed directly with the customer. Otherwise send a quotation: it becomes a booking when accepted." />
    <BookingForm customers={customers} services={ctx.services.filter(s => s.on).map(s => ({ key: s.key, name: s.name }))} eventTypes={eventTypes} taken={taken} today={today}
      showCrew={has(ctx.tenant, 'staff')} branches={ent ? ctx.custom.branches ?? [] : []} eventFields={ent ? ctx.custom.eventFields ?? [] : []} />
  </>);
}
