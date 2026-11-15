'use server';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { requireUser, denied, logActivity, type ActionState } from '@/lib/session';
import { CATALOG } from '@/lib/catalog';
import { atLeast } from '@/lib/plans';
import { CHECKLIST } from '@/lib/tools';
import { computePurchase, loadRows } from '@/lib/tool-server';
import { addDays, newId, todayIST } from '@/lib/util';

export async function saveServicesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const no = denied(ctx, 'services'); if (no) return { error: no };
  const out: Record<string, { on: boolean; price: number }> = {};
  for (const c of CATALOG) {
    const price = Number(fd.get(`price_${c.key}`));
    out[c.key] = { on: fd.get(`on_${c.key}`) === 'on', price: Number.isFinite(price) && price >= 0 && price <= 10000000 ? Math.round(price) : c.price };
  }
  if (!Object.values(out).some(s => s.on)) return { error: 'Switch on at least one service you offer.' };
  await ctx.db.update(schema.tenants).set({ services: out }).where(eq(schema.tenants.id, ctx.tenant.id));
  await logActivity(ctx, 'Updated services and prices');
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Services saved. Their tools are in the Services menu.' };
}

async function toolCtx(toolKey: string, coll?: string) {
  const ctx = await requireUser();
  const tool = ctx.tools.find(t => t.key === toolKey);
  if (!tool) return { ctx, error: 'This tool is not switched on. Turn on its service in My services.' } as const;
  const no = denied(ctx, `tool:${toolKey}`); if (no) return { ctx, error: no } as const;
  const tab = coll ? tool.tabs.find(t => t.coll === coll) : undefined;
  if (coll && !tab) return { ctx, error: 'Unknown list.' } as const;
  if (tab?.plan && !atLeast(ctx.tenant, tab.plan)) return { ctx, error: `${tab.label} comes with the ${tab.plan === 'pro' ? 'Pro' : 'Enterprise'} plan.` } as const;
  return { ctx, tool, tab } as const;
}

export async function addToolRowAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const r = await toolCtx(String(fd.get('tool') ?? ''), String(fd.get('coll') ?? ''));
  if ('error' in r) return { error: r.error };
  const { ctx, tool, tab } = r;
  const fields = tab!.fields ?? [];
  const rows = await loadRows(ctx, tool.key);
  const data: Record<string, unknown> = {};
  const fe: Record<string, string> = {};
  let bookingId: string | null = null;
  for (const f of fields) {
    const key = 'f_' + f.f;
    if (f.type === 'multi') {
      const ids = fd.getAll(key).map(String).filter(id => (rows[f.ref!.coll] ?? []).some(x => x.id === id));
      if (f.req && !ids.length) fe[key] = `Choose at least one.`;
      data[f.f] = ids; continue;
    }
    if (f.type === 'rows') {
      const list: { ref: string; qty: number }[] = [];
      for (let i = 0; i < 8; i++) {
        const ref = String(fd.get(`${key}_ref_${i}`) ?? ''), qty = Number(fd.get(`${key}_qty_${i}`));
        if (ref && qty > 0 && (rows[f.ref!.coll] ?? []).some(x => x.id === ref)) list.push({ ref, qty: Math.round(qty * 100) / 100 });
      }
      data[f.f] = list; continue;
    }
    const v = String(fd.get(key) ?? '').trim();
    if (!v) { if (f.req) fe[key] = `Enter ${f.label.toLowerCase()}.`; else data[f.f] = f.type === 'number' ? 0 : ''; continue; }
    if (f.type === 'number') { const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > 100000000) { fe[key] = 'Enter a valid number.'; continue; } data[f.f] = n; continue; }
    if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) { fe[key] = 'Choose a date.'; continue; }
    if (f.type === 'time' && !/^\d{2}:\d{2}$/.test(v)) { fe[key] = 'Choose a time.'; continue; }
    if (f.type === 'select') {
      const okv = f.opts ? f.opts.includes(v) : (rows[f.ref!.coll] ?? []).some(x => x.id === v);
      if (!okv) { fe[key] = 'Choose from the list.'; continue; }
    }
    if (f.type === 'event') {
      const [b] = await ctx.db.select({ id: schema.bookings.id }).from(schema.bookings).where(and(eq(schema.bookings.id, v), eq(schema.bookings.tenantId, ctx.tenant.id))).limit(1);
      if (!b) { fe[key] = 'Choose the event.'; continue; }
      bookingId = b.id;
    }
    data[f.f] = v.slice(0, 300);
  }
  if (Object.keys(fe).length) return { fieldErrors: fe, error: 'Please correct the highlighted fields.' };
  Object.assign(data, tab!.init ?? {}, { created: todayIST() });
  await ctx.db.insert(schema.toolRows).values({ id: newId(), tenantId: ctx.tenant.id, tool: tool.key, coll: tab!.coll!, bookingId, data });
  await logActivity(ctx, `Added ${tab!.noun?.toLowerCase() ?? 'entry'} in ${tool.label}`);
  revalidatePath(`/services/tools/${tool.key}`);
  return { ok: true, message: `${tab!.noun ?? 'Entry'} added.` };
}

export async function setToolFieldAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const r = await toolCtx(String(fd.get('tool') ?? ''), String(fd.get('coll') ?? ''));
  if ('error' in r) return { error: r.error };
  const { ctx, tool, tab } = r;
  const f = String(fd.get('f') ?? ''), value = String(fd.get('value') ?? '');
  const col = tab!.cols?.find(c => c.c.k === 'status' && c.c.f === f);
  if (!col || col.c.k !== 'status' || !col.c.opts.includes(value)) return { error: 'Not allowed.' };
  const id = String(fd.get('rid') ?? '');
  const [row] = await ctx.db.select().from(schema.toolRows).where(and(eq(schema.toolRows.id, id), eq(schema.toolRows.tenantId, ctx.tenant.id), eq(schema.toolRows.tool, tool.key))).limit(1);
  if (!row) return { error: 'Not found.' };
  await ctx.db.update(schema.toolRows).set({ data: { ...(row.data as object), [f]: value } }).where(eq(schema.toolRows.id, id));
  revalidatePath(`/services/tools/${tool.key}`);
  return { ok: true };
}

export async function deleteToolRowAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const r = await toolCtx(String(fd.get('tool') ?? ''));
  if ('error' in r) return { error: r.error };
  const { ctx, tool } = r;
  const rows = await ctx.db.delete(schema.toolRows).where(and(eq(schema.toolRows.id, String(fd.get('rid') ?? '')), eq(schema.toolRows.tenantId, ctx.tenant.id), eq(schema.toolRows.tool, tool.key))).returning();
  if (!rows.length) return { error: 'Not found.' };
  revalidatePath(`/services/tools/${tool.key}`);
  return { ok: true };
}

/** Saves the purchase generator's result as a purchase list (Pro). */
export async function savePurchaseListAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const r = await toolCtx('catering', 'plists');
  if ('error' in r) return { error: r.error };
  const { ctx } = r;
  const rows = await loadRows(ctx, 'catering');
  const menu = (rows.menus ?? []).find(m => m.id === String(fd.get('menu') ?? ''));
  if (!menu) return { error: 'Choose a menu.' };
  const [b] = menu.bookingId ? await ctx.db.select().from(schema.bookings).where(eq(schema.bookings.id, menu.bookingId)).limit(1) : [];
  const plates = Number(menu.plates) || b?.guests || 100;
  const items = computePurchase(rows.ingredients ?? [], rows.dishes ?? [], menu.dishes ?? [], plates);
  const cost = Math.round(items.reduce((s, i) => s + i.qty * i.rate, 0));
  await ctx.db.insert(schema.toolRows).values({ id: newId(), tenantId: ctx.tenant.id, tool: 'catering', coll: 'plists', bookingId: menu.bookingId, data: { items, cost, status: 'Pending', created: todayIST(), menu: menu.id } });
  await logActivity(ctx, `Saved a purchase list for ${b?.title ?? 'an event'}`);
  revalidatePath('/services/tools/catering');
  return { ok: true, message: 'Purchase list saved. Find it under Purchase lists.' };
}

/** Planning: adds the standard wedding checklist for an event, dated back from the event day. */
export async function addChecklistAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const r = await toolCtx('planning', 'tasks');
  if ('error' in r) return { error: r.error };
  const { ctx } = r;
  const [b] = await ctx.db.select().from(schema.bookings).where(and(eq(schema.bookings.id, String(fd.get('event') ?? '')), eq(schema.bookings.tenantId, ctx.tenant.id))).limit(1);
  if (!b) return { error: 'Choose the event.' };
  await ctx.db.insert(schema.toolRows).values(CHECKLIST.map(([task, off]) => ({ id: newId(), tenantId: ctx.tenant.id, tool: 'planning', coll: 'tasks', bookingId: b.id,
    data: { eventId: b.id, task, owner: '', due: addDays(b.eventDate, off), status: 'To do', created: todayIST() } })));
  await logActivity(ctx, `Added the standard checklist for ${b.title}`);
  revalidatePath('/services/tools/planning');
  return { ok: true, message: `${CHECKLIST.length} tasks added for ${b.title}.` };
}
