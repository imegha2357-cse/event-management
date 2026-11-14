import { asc, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser } from '@/lib/session';
import { PageHead } from '@/components/page';
import { addDays, todayIST } from '@/lib/util';
import { QuoteForm } from '../form';
export const metadata = { title: 'New quotation' };
export default async function NewQuote({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer = '' } = await searchParams;
  const { db, tenant } = await requireUser();
  const customers = await db.select({ id: schema.customers.id, name: schema.customers.name, phone: schema.customers.phone }).from(schema.customers).where(eq(schema.customers.tenantId, tenant.id)).orderBy(asc(schema.customers.name));
  const today = todayIST();
  return (<>
    <PageHead title="New quotation" sub="Saved as a draft. You can share it with the customer from the next screen." />
    <QuoteForm today={today} customers={customers} init={{ customerId: customers.some(c => c.id === customer) ? customer : '', eventType: '', eventTitle: '', eventDate: '', startTime: '', endTime: '', venue: '', guests: 0, validUntil: addDays(today, 14), discount: 0, notes: '', items: [] }} />
  </>);
}
