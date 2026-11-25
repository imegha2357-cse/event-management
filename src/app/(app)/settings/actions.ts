'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import { schema } from '@/db';
import type { TenantCustom } from '@/db/schema';
import { requireUser, denied, logActivity, zodFieldErrors, type ActionState, type Ctx } from '@/lib/session';
import { DEFAULT_ROLES, GROUP_LABEL, LIMITS, PERM_KEYS, isEnt, perk, rolesOf } from '@/lib/plans';
import { DOC_STYLES, SWATCHES } from '@/lib/catalog';
import { newId } from '@/lib/util';

const ownerOnly = async () => { const ctx = await requireUser(); return ctx.user.role === 'Owner' ? { ctx } : { ctx, error: 'Only the owner can change this.' }; };
const image = z.string().max(300000, 'The logo is too large.').refine(v => !v || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v), 'The logo could not be read.');

export async function saveCompanyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await ownerOnly(); if (error) return { error };
  const parsed = z.object({
    name: z.string().trim().min(2, 'Enter your company name.').max(120),
    phone: z.string().trim().regex(/^[0-9+\s-]{10,15}$/, 'Enter a valid phone number.'),
    city: z.string().trim().min(2, 'Enter your city.').max(60),
    address: z.string().trim().max(300).optional().default(''),
    gstin: z.string().trim().toUpperCase().regex(/^$|^[0-9A-Z]{15}$/, 'GSTIN has 15 letters and numbers.').optional().default(''),
    colour: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    logo: image.optional().default(''),
    docStyle: z.string().optional(),
    terms: z.string().trim().max(1000).optional().default(''),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const set: Partial<typeof schema.tenants.$inferInsert> = { name: d.name, phone: d.phone, city: d.city, address: d.address, gstin: d.gstin, logo: d.logo };
  if (d.colour && SWATCHES.includes(d.colour)) set.colour = d.colour;
  if (perk(ctx.tenant, 'docDesigns')) { if (d.docStyle && DOC_STYLES[d.docStyle]) set.docStyle = d.docStyle; set.terms = d.terms; }
  await ctx.db.update(schema.tenants).set(set).where(eq(schema.tenants.id, ctx.tenant.id));
  await logActivity(ctx, 'Updated company settings');
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Company details saved.' };
}

/* ---------------- Team and roles ---------------- */
export async function addMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await ownerOnly(); if (error) return { error };
  const no = denied(ctx, 'team'); if (no) return { error: no };
  const roles = rolesOf(ctx.tenant).map(r => r.name);
  const parsed = z.object({
    name: z.string().trim().min(2, 'Enter their name.').max(80),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
    phone: z.string().trim().max(20).optional().default(''),
    role: z.string().refine(r => roles.includes(r), 'Choose a role.'),
    password: z.string().min(8, 'Use at least 8 characters.').max(72).regex(/[A-Za-z]/, 'Include a letter.').regex(/\d/, 'Include a number.'),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
  const lim = LIMITS[ctx.plan].users;
  const [{ n }] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(schema.users).where(and(eq(schema.users.tenantId, ctx.tenant.id), eq(schema.users.active, true)));
  if (n >= lim) return { error: `Your plan allows ${lim} login${lim === 1 ? '' : 's'}. Ask for an upgrade in Settings → Plan.` };
  const [exists] = await ctx.db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, parsed.data.email)).limit(1);
  if (exists) return { fieldErrors: { email: 'This email already has an EventDesk login.' } };
  await ctx.db.insert(schema.users).values({ id: newId(), tenantId: ctx.tenant.id, name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone, role: parsed.data.role, passwordHash: await bcrypt.hash(parsed.data.password, 12) });
  await logActivity(ctx, `Added ${parsed.data.name} as ${parsed.data.role}`);
  revalidatePath('/staff/team');
  return { ok: true, message: `${parsed.data.name} can now sign in with ${parsed.data.email} and the password you set. Ask them to change it from “Forgot password”.` };
}

export async function setMemberRoleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await ownerOnly(); if (error) return { error };
  const role = String(fd.get('role') ?? '');
  if (!rolesOf(ctx.tenant).some(r => r.name === role)) return { error: 'Unknown role.' };
  const rows = await ctx.db.update(schema.users).set({ role }).where(and(eq(schema.users.id, String(fd.get('rid') ?? '')), eq(schema.users.tenantId, ctx.tenant.id), sql`${schema.users.role} <> 'Owner'`)).returning();
  if (!rows.length) return { error: 'Not found.' };
  await logActivity(ctx, `Changed ${rows[0].name}’s role to ${role}`);
  revalidatePath('/staff/team');
  return { ok: true };
}

export async function removeMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await ownerOnly(); if (error) return { error };
  const rows = await ctx.db.update(schema.users).set({ active: false }).where(and(eq(schema.users.id, String(fd.get('rid') ?? '')), eq(schema.users.tenantId, ctx.tenant.id), sql`${schema.users.role} <> 'Owner'`)).returning();
  if (!rows.length) return { error: 'Not found.' };
  await logActivity(ctx, `Removed ${rows[0].name}’s login`);
  revalidatePath('/staff/team');
  return { ok: true, message: `${rows[0].name} can no longer sign in.` };
}

/* ---------------- Enterprise: Customize ---------------- */
async function entCtx() {
  const { ctx, error } = await ownerOnly(); if (error) return { ctx, error };
  if (!isEnt(ctx.tenant)) return { ctx, error: 'Customize comes with the Enterprise plan.' };
  return { ctx };
}
async function saveCustom(ctx: Ctx, patch: (c: TenantCustom) => TenantCustom, what: string) {
  const next = patch(structuredClone(ctx.tenant.custom ?? {}));
  await ctx.db.update(schema.tenants).set({ custom: next }).where(eq(schema.tenants.id, ctx.tenant.id));
  await logActivity(ctx, what);
  revalidatePath('/', 'layout');
}
const slug = () => Math.random().toString(36).slice(2, 9);

export async function saveRolesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await entCtx(); if (error) return { error };
  const roles = rolesOf(ctx.tenant).map((r, i) => ({ name: r.name, perms: PERM_KEYS.filter(k => fd.get(`p_${i}_${k}`) === 'on') }));
  await saveCustom(ctx, c => ({ ...c, roles }), 'Changed what each role can open');
  return { ok: true, message: 'Roles saved.' };
}
export async function addRoleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await entCtx(); if (error) return { error };
  const name = String(fd.get('name') ?? '').trim().slice(0, 40);
  if (name.length < 2) return { fieldErrors: { name: 'Enter a role name.' } };
  const roles = rolesOf(ctx.tenant);
  if (name === 'Owner' || roles.some(r => r.name.toLowerCase() === name.toLowerCase())) return { fieldErrors: { name: 'That role already exists.' } };
  await saveCustom(ctx, c => ({ ...c, roles: [...roles, { name, perms: ['calendar', 'events'] }] }), `Created role ${name}`);
  return { ok: true, message: `Role ${name} added. Tick what it can open below.` };
}
export async function deleteRoleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await entCtx(); if (error) return { error };
  const name = String(fd.get('name') ?? '');
  if (DEFAULT_ROLES.some(r => r.name === name)) return { error: 'The ready roles cannot be deleted.' };
  const [used] = await ctx.db.select({ id: schema.users.id }).from(schema.users).where(and(eq(schema.users.tenantId, ctx.tenant.id), eq(schema.users.role, name), eq(schema.users.active, true))).limit(1);
  if (used) return { error: 'Someone still has this role. Change their role first.' };
  await saveCustom(ctx, c => ({ ...c, roles: rolesOf(ctx.tenant).filter(r => r.name !== name) }), `Deleted role ${name}`);
  return { ok: true };
}

export async function saveBrandingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await entCtx(); if (error) return { error };
  const appName = String(fd.get('appName') ?? '').trim().slice(0, 40);
  const colour = String(fd.get('colour') ?? '');
  if (colour && !/^#[0-9a-fA-F]{6}$/.test(colour)) return { error: 'Choose a valid colour.' };
  await saveCustom(ctx, c => ({ ...c, appName, colour: fd.get('reset') === '1' ? '' : colour }), 'Changed app name and brand colour');
  return { ok: true, message: 'Branding saved.' };
}
export async function saveMenuAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await entCtx(); if (error) return { error };
  const keys = Object.keys(GROUP_LABEL).filter(k => !['dashboard', 'settings'].includes(k));
  const labels: Record<string, string> = {}, hidden: string[] = [];
  for (const k of keys) { const l = String(fd.get(`label_${k}`) ?? '').trim().slice(0, 30); if (l) labels[k] = l; if (fd.get(`show_${k}`) !== 'on') hidden.push(k); }
  await saveCustom(ctx, c => ({ ...c, labels, hidden }), 'Changed menu names');
  return { ok: true, message: 'Menu saved.' };
}
export async function addFieldAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await entCtx(); if (error) return { error };
  const where = fd.get('where') === 'customerFields' ? 'customerFields' : 'eventFields';
  const label = String(fd.get('label') ?? '').trim().slice(0, 40);
  const type = String(fd.get('type') ?? 'text') as 'text' | 'number' | 'date' | 'select';
  const options = String(fd.get('options') ?? '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
  if (label.length < 2) return { fieldErrors: { label: 'Enter the field name.' } };
  if (!['text', 'number', 'date', 'select'].includes(type)) return { error: 'Choose a type.' };
  if (type === 'select' && options.length < 2) return { fieldErrors: { options: 'Enter at least two choices, separated by commas.' } };
  await saveCustom(ctx, c => ({ ...c, [where]: [...(c[where] ?? []), { id: slug(), label, type, options: type === 'select' ? options : undefined }] }), `Added field “${label}”`);
  return { ok: true, message: `Field “${label}” added.` };
}
export async function deleteFieldAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await entCtx(); if (error) return { error };
  const where = fd.get('where') === 'customerFields' ? 'customerFields' : 'eventFields';
  await saveCustom(ctx, c => ({ ...c, [where]: (c[where] ?? []).filter(f => f.id !== fd.get('rid')) }), 'Deleted a custom field');
  return { ok: true };
}
export async function addStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await entCtx(); if (error) return { error };
  const s = String(fd.get('status') ?? '').trim().slice(0, 30);
  if (s.length < 2) return { fieldErrors: { status: 'Enter a status.' } };
  if (['Enquiry', 'Confirmed', 'Completed', 'Declined', 'Cancelled', ...(ctx.custom.statuses ?? [])].some(x => x.toLowerCase() === s.toLowerCase())) return { fieldErrors: { status: 'That status already exists.' } };
  await saveCustom(ctx, c => ({ ...c, statuses: [...(c.statuses ?? []), s] }), `Added event status “${s}”`);
  return { ok: true, message: `Status “${s}” added.` };
}
export async function deleteStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await entCtx(); if (error) return { error };
  const s = String(fd.get('status') ?? '');
  const [used] = await ctx.db.select({ id: schema.bookings.id }).from(schema.bookings).where(and(eq(schema.bookings.tenantId, ctx.tenant.id), eq(schema.bookings.status, s))).limit(1);
  if (used) return { error: `Some events still have the status “${s}”. Change them first.` };
  await saveCustom(ctx, c => ({ ...c, statuses: (c.statuses ?? []).filter(x => x !== s) }), `Removed event status “${s}”`);
  return { ok: true };
}
export async function saveDocsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await entCtx(); if (error) return { error };
  const parsed = z.object({
    quoteTitle: z.string().trim().min(2).max(30), invTitleGst: z.string().trim().min(2).max(30), invTitle: z.string().trim().min(2).max(30),
    prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,8}$/, 'Use 1 to 8 letters or numbers.'),
    gstRate: z.coerce.number().refine(v => [5, 12, 18, 28].includes(v)), validDays: z.coerce.number().int().min(1).max(365),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
  await saveCustom(ctx, c => ({ ...c, doc: { ...parsed.data, words: fd.get('words') === 'on', sign: fd.get('sign') === 'on' } }), 'Changed quotation and invoice settings');
  return { ok: true, message: 'Document settings saved.' };
}
export async function addToolAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await entCtx(); if (error) return { error };
  const name = String(fd.get('name') ?? '').trim().slice(0, 40);
  if (name.length < 2) return { fieldErrors: { name: 'Enter the tool name.' } };
  const fields = Array.from({ length: 6 }, (_, i) => ({ label: String(fd.get(`f${i}`) ?? '').trim().slice(0, 40), type: String(fd.get(`t${i}`) ?? 'text'), options: String(fd.get(`o${i}`) ?? '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 20) }))
    .filter(f => f.label).map(f => ({ id: slug(), label: f.label, type: (['text', 'number', 'date', 'event', 'select'].includes(f.type) ? f.type : 'text') as 'text', options: f.type === 'select' ? f.options : undefined }));
  if (!fields.length) return { error: 'Add at least one field.' };
  if (fields.some(f => f.type === ('select' as string) && (f.options?.length ?? 0) < 2)) return { error: 'Choice-list fields need at least two choices, separated by commas.' };
  const icon = String(fd.get('icon') ?? 'wand');
  await saveCustom(ctx, c => ({ ...c, tools: [...(c.tools ?? []), { id: slug(), name, icon, fields }] }), `Built a new tool “${name}”`);
  return { ok: true, message: `“${name}” is ready in Services.` };
}
export async function deleteToolAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await entCtx(); if (error) return { error };
  const id = String(fd.get('rid') ?? '');
  await ctx.db.delete(schema.toolRows).where(and(eq(schema.toolRows.tenantId, ctx.tenant.id), eq(schema.toolRows.tool, 'ct_' + id)));
  await saveCustom(ctx, c => ({ ...c, tools: (c.tools ?? []).filter(t => t.id !== id) }), 'Deleted a custom tool');
  return { ok: true };
}
export async function addBranchAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await entCtx(); if (error) return { error };
  const name = String(fd.get('name') ?? '').trim().slice(0, 60);
  if (name.length < 2) return { fieldErrors: { name: 'Enter the branch name.' } };
  await saveCustom(ctx, c => ({ ...c, branches: [...(c.branches ?? []), { id: slug(), name, city: String(fd.get('city') ?? '').trim().slice(0, 60), manager: String(fd.get('manager') ?? '').trim().slice(0, 60) }] }), `Added branch ${name}`);
  return { ok: true, message: `Branch ${name} added.` };
}
export async function deleteBranchAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, error } = await entCtx(); if (error) return { error };
  const id = String(fd.get('rid') ?? '');
  await ctx.db.update(schema.bookings).set({ branchId: null }).where(and(eq(schema.bookings.tenantId, ctx.tenant.id), eq(schema.bookings.branchId, id)));
  await saveCustom(ctx, c => ({ ...c, branches: (c.branches ?? []).filter(b => b.id !== id) }), 'Deleted a branch');
  return { ok: true };
}

/* ---------------- Vendors (Enterprise) ---------------- */
export async function addVendorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const no = denied(ctx, 'vendors'); if (no) return { error: no };
  const parsed = z.object({ name: z.string().trim().min(2, 'Enter the vendor name.').max(100), category: z.string().trim().max(60).optional().default(''), phone: z.string().trim().max(20).optional().default(''), notes: z.string().trim().max(300).optional().default('') }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
  await ctx.db.insert(schema.vendors).values({ id: newId(), tenantId: ctx.tenant.id, ...parsed.data });
  await logActivity(ctx, `Added vendor ${parsed.data.name}`);
  revalidatePath('/staff/vendors');
  return { ok: true, message: `${parsed.data.name} added.` };
}
export async function deleteVendorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const no = denied(ctx, 'vendors'); if (no) return { error: no };
  const rows = await ctx.db.delete(schema.vendors).where(and(eq(schema.vendors.id, String(fd.get('rid') ?? '')), eq(schema.vendors.tenantId, ctx.tenant.id))).returning();
  if (rows[0]) await logActivity(ctx, `Deleted vendor ${rows[0].name}`);
  revalidatePath('/staff/vendors');
  return { ok: true };
}

