import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { schema } from '@/db';
import type { Ctx } from './session';
import { EVENT_TYPES } from './catalog';
import { docCfg } from './docs';

/** Shared data for quotation/invoice forms. */
export async function quoteFormData(ctx: Ctx) {
  const customers = await ctx.db.select({ id: schema.customers.id, name: schema.customers.name, phone: schema.customers.phone }).from(schema.customers)
    .where(eq(schema.customers.tenantId, ctx.tenant.id)).orderBy(asc(schema.customers.name));
  const services = ctx.services.filter(s => s.on).map(s => ({ key: s.key, name: s.name, price: s.price, unit: s.unit }));
  return { customers, services, eventTypes: EVENT_TYPES, gstRate: docCfg(ctx.tenant).gstRate, gstAllowed: Boolean(ctx.tenant.gstin) };
}
