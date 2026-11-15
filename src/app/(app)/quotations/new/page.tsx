import { and, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead } from '@/components/page';
import { Gate } from '@/components/locked';
import { addDays, todayIST } from '@/lib/util';
import { docCfg } from '@/lib/docs';
import { quoteFormData } from '@/lib/form-data';
import { QuoteForm } from '../form';
export const metadata = { title: 'New quotation' };

export default async function NewQuote({ searchParams }: { searchParams: Promise<{ customer?: string; booking?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireUser();
  const g = gate(ctx, 'quotations'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const data = await quoteFormData(ctx);
  const today = todayIST();
  const [b] = sp.booking ? await ctx.db.select().from(schema.bookings).where(and(eq(schema.bookings.id, sp.booking), eq(schema.bookings.tenantId, ctx.tenant.id))).limit(1) : [];
  const svcItems = (b?.services ?? []).map(k => ctx.services.find(s => s.key === k)).filter(Boolean).map(s => ({ desc: `${s!.name} (${s!.unit})`, qty: s!.unit === 'per plate' ? b!.guests || 1 : 1, rate: s!.price }));
  return (<>
    <PageHead title="New quotation" sub="Saved as a draft. Share it with the customer from the next screen." />
    <QuoteForm today={today} {...data} linkedTitle={b && !b.quotationId ? b.title : undefined}
      init={{ bookingId: b && !b.quotationId ? b.id : undefined, customerId: b?.customerId ?? (data.customers.some(c => c.id === sp.customer) ? sp.customer! : ''),
        eventType: b?.eventType ?? '', eventTitle: b?.title ?? '', eventDate: b && b.eventDate >= today ? b.eventDate : '', startTime: b?.startTime ?? '', endTime: b?.endTime ?? '',
        venue: b?.venue ?? '', guests: b?.guests ?? 0, validUntil: addDays(today, docCfg(ctx.tenant).validDays), discount: 0, notes: b?.notes ?? '', items: svcItems, gst: Boolean(ctx.tenant.gstin) }} />
  </>);
}
