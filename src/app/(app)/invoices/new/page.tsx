import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead } from '@/components/page';
import { Gate } from '@/components/locked';
import { docCfg } from '@/lib/docs';
import { fmtDate, todayIST } from '@/lib/util';
import { InvoiceForm } from './form';
export const metadata = { title: 'New invoice' };

export default async function NewInvoice({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const { booking } = await searchParams;
  const ctx = await requireUser();
  const g = gate(ctx, 'invoices'); if (g) return <Gate g={g} plan={ctx.plan} />;
  if (!booking) return (<><PageHead title="New invoice" /><div className="body narrow"><div className="notice">Invoices are made from a booking. Open a booking and choose <b>Create invoice</b>. <Link href="/bookings">Go to bookings</Link></div></div></>);
  const [b] = await ctx.db.select().from(schema.bookings).where(and(eq(schema.bookings.id, booking), eq(schema.bookings.tenantId, ctx.tenant.id))).limit(1);
  if (!b) notFound();
  const [existing] = await ctx.db.select().from(schema.invoices).where(eq(schema.invoices.bookingId, b.id)).limit(1);
  if (existing) redirect(`/invoices/${existing.id}`);
  const [q] = b.quotationId ? await ctx.db.select().from(schema.quotations).where(eq(schema.quotations.id, b.quotationId)).limit(1) : [];
  const svcLines = (b.services ?? []).map(k => ctx.services.find(s => s.key === k)).filter(Boolean).map(s => ({ desc: `${s!.name} (${s!.unit})`, qty: s!.unit === 'per plate' ? b.guests || 1 : 1, rate: s!.price }));
  const items = q?.items?.length ? q.items : b.items?.length ? b.items : svcLines;
  return (<>
    <PageHead title="New invoice" sub={`${b.title} · ${fmtDate(b.eventDate)}${q ? ' · filled from the accepted quotation' : ''}`} />
    <InvoiceForm bookingId={b.id} items={items} discount={q?.discount ?? 0} gst={q ? q.gst : Boolean(ctx.tenant.gstin)} gstRate={docCfg(ctx.tenant).gstRate} gstAllowed={Boolean(ctx.tenant.gstin)}
      services={ctx.services.filter(s => s.on).map(s => ({ key: s.key, name: s.name, price: s.price, unit: s.unit }))} today={todayIST()} guests={b.guests} />
  </>);
}
