import { requireUser, gate } from '@/lib/session';
import { PageHead } from '@/components/page';
import { Gate } from '@/components/locked';
import { TOOLS } from '@/lib/tools';
import { ServicesForm } from './services-form';
export const metadata = { title: 'My services' };

export default async function Services() {
  const ctx = await requireUser();
  const g = gate(ctx, 'services'); if (g) return <Gate g={g} plan={ctx.plan} />;
  const n = ctx.services.filter(s => s.on).length;
  return (<>
    <PageHead title="My services" sub={`Switch on only what ${ctx.tenant.name} offers (${n} of ${ctx.services.length} now). Each service brings its own tools into the Services menu, already filled with starter recipes, designs or packages. Prices fill into quotations.`} />
    <ServicesForm services={ctx.services.map(s => ({ key: s.key, name: s.name, unit: s.unit, price: s.price, on: s.on, tools: TOOLS.filter(t => t.services.includes(s.key)).map(t => t.label) }))} />
  </>);
}
