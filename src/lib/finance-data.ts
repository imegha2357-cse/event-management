import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { schema } from '@/db';
import type { Ctx } from './session';

/** Payments received and expenses per month (YYYY-MM), for charts and month totals. */
export async function monthlyMoney(ctx: Pick<Ctx, 'db' | 'tenant'>) {
  const P = schema.invoicePayments, E = schema.expenses;
  const inc = await ctx.db.select({ m: sql<string>`to_char(${P.paidOn}, 'YYYY-MM')`, s: sql<number>`sum(${P.amount})::int` }).from(P).where(eq(P.tenantId, ctx.tenant.id)).groupBy(sql`1`);
  const sp = await ctx.db.select({ m: sql<string>`to_char(${E.spentOn}, 'YYYY-MM')`, s: sql<number>`sum(${E.amount})::int` }).from(E).where(eq(E.tenantId, ctx.tenant.id)).groupBy(sql`1`);
  return { income: (k: string) => inc.find(r => r.m === k)?.s ?? 0, spend: (k: string) => sp.find(r => r.m === k)?.s ?? 0 };
}
