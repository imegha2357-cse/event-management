import 'server-only';
import { and, eq } from 'drizzle-orm';
import { schema } from '@/db';
import type { Ctx } from './session';

export type Row = { id: string; bookingId: string | null; createdAt: Date } & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function loadRows(ctx: Pick<Ctx, 'db' | 'tenant'>, toolKey: string) {
  const rows = await ctx.db.select().from(schema.toolRows).where(and(eq(schema.toolRows.tenantId, ctx.tenant.id), eq(schema.toolRows.tool, toolKey)));
  const by: Record<string, Row[]> = {};
  for (const r of rows) (by[r.coll] ??= []).push({ ...(r.data as Record<string, unknown>), id: r.id, bookingId: r.bookingId, createdAt: r.createdAt } as Row);
  return by;
}

/* ---------- Catering and decoration maths ---------- */
export const dishCost = (ings: Row[], dish: Row) => ((dish.recipe ?? []) as { ref: string; qty: number }[]).reduce((s, r) => s + r.qty * (ings.find(g => g.id === r.ref)?.rate ?? 0), 0) / 100;
export function computePurchase(ings: Row[], dishes: Row[], menuDishIds: string[], plates: number) {
  const tot: Record<string, number> = {};
  for (const id of menuDishIds) { const d = dishes.find(x => x.id === id); if (!d) continue; for (const r of d.recipe ?? []) tot[r.ref] = (tot[r.ref] ?? 0) + (r.qty * plates) / 100; }
  return Object.entries(tot).map(([ref, qty]) => { const g = ings.find(x => x.id === ref) ?? { name: 'Removed ingredient', cat: '', unit: '', rate: 0 }; return { name: String(g.name), cat: String(g.cat), unit: String(g.unit), rate: Number(g.rate), qty: Math.ceil(qty * 10) / 10 }; })
    .sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));
}
