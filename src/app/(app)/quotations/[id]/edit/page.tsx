import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, gate } from '@/lib/session';
import { PageHead } from '@/components/page';
import { Gate } from '@/components/locked';
import { todayIST } from '@/lib/util';
import { quoteLabel } from '@/lib/docs';
import { OPEN_STATUSES } from '@/lib/quotes';
import { quoteFormData } from '@/lib/form-data';
import { QuoteForm } from '../../form';
export const metadata = { title: 'Edit quotation' };
export default async function EditQuote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireUser();
  const g = gate(ctx, 'quotations'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const [q] = await ctx.db.select().from(schema.quotations).where(and(eq(schema.quotations.id, id), eq(schema.quotations.tenantId, ctx.tenant.id))).limit(1);
  if (!q) notFound();
  if (!OPEN_STATUSES.includes(q.status)) redirect(`/quotations/${id}`);
  const data = await quoteFormData(ctx);
  return (<>
    <PageHead title={`Edit ${quoteLabel(ctx.tenant, q.number)}`} sub={q.status === 'Sent' ? 'Already sent: your customer will see the updated version on the same link.' : undefined} />
    <QuoteForm today={todayIST()} {...data} init={{ ...q, id: q.id, bookingId: q.bookingId ?? undefined }} />
  </>);
}
