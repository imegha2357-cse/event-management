import { notFound, redirect } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser } from '@/lib/session';
import { PageHead } from '@/components/page';
import { quoteNo, todayIST } from '@/lib/util';
import { OPEN_STATUSES } from '@/lib/quotes';
import { QuoteForm } from '../../form';
export const metadata = { title: 'Edit quotation' };
export default async function EditQuote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, tenant } = await requireUser();
  const [q] = await db.select().from(schema.quotations).where(and(eq(schema.quotations.id, id), eq(schema.quotations.tenantId, tenant.id))).limit(1);
  if (!q) notFound();
  if (!OPEN_STATUSES.includes(q.status)) redirect(`/quotations/${id}`);
  const customers = await db.select({ id: schema.customers.id, name: schema.customers.name, phone: schema.customers.phone }).from(schema.customers).where(eq(schema.customers.tenantId, tenant.id)).orderBy(asc(schema.customers.name));
  return (<>
    <PageHead title={`Edit ${quoteNo(q.number)}`} sub={q.status === 'Sent' ? 'Already sent: your customer will see the updated version on the same link.' : undefined} />
    <QuoteForm today={todayIST()} customers={customers} init={{ ...q, id: q.id }} />
  </>);
}
