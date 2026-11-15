import { PageHead } from '@/components/page';
import { requireUser, gate } from '@/lib/session';
import { Gate } from '@/components/locked';
import { isEnt } from '@/lib/plans';
import { CustomerForm } from '../form';
export const metadata = { title: 'New customer' };
export default async function NewCustomer({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  const ctx = await requireUser();
  const g = gate(ctx, 'customers'); if (g) return <Gate g={g} plan={ctx.plan} />;
  return (<><PageHead title="New customer" /><div className="body narrow"><CustomerForm returnTo={returnTo} fields={isEnt(ctx.tenant) ? ctx.custom.customerFields ?? [] : []} /></div></>);
}
