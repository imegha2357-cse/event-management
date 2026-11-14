import { PageHead } from '@/components/page';
import { CustomerForm } from '../form';
export const metadata = { title: 'New customer' };
export default async function NewCustomer({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  return (<><PageHead title="New customer" /><div className="body narrow"><CustomerForm returnTo={returnTo} /></div></>);
}
