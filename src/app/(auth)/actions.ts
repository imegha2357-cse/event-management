'use server';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { signIn, signOut } from '@/auth';
import { getDb, schema } from '@/db';
import { newId, randomToken, sha256 } from '@/lib/util';
import { requireUser, zodFieldErrors, type ActionState } from '@/lib/session';
import { siteOrigin } from '@/lib/origin';
import { emailConfigured, sendEmail } from '@/lib/email';

const email = z.string().trim().toLowerCase().min(1, 'Enter your email address.').email('Enter a valid email address.');
const password = z.string().min(8, 'Use at least 8 characters.').max(72, 'Use at most 72 characters.')
  .regex(/[A-Za-z]/, 'Include at least one letter.').regex(/\d/, 'Include at least one number.');

function safeNext(v: FormDataEntryValue | null) {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/dashboard';
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ email, password: z.string().min(1, 'Enter your password.') }).safeParse({ email: fd.get('email'), password: fd.get('password') });
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
  try {
    await signIn('credentials', { ...parsed.data, redirectTo: safeNext(fd.get('next')) });
  } catch (e) {
    if (e instanceof AuthError) return { error: 'Incorrect email or password.' };
    throw e; // successful sign-in redirects by throwing
  }
}

export async function googleAction(fd: FormData) {
  await signIn('google', { redirectTo: safeNext(fd.get('next')) });
}

export async function logoutAction() {
  await signOut({ redirectTo: '/login' });
}

export async function signupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({
    name: z.string().trim().min(2, 'Enter your full name.').max(80),
    company: z.string().trim().min(2, 'Enter your company name.').max(120),
    email, password,
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
  const db = await getDb();
  const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, parsed.data.email)).limit(1);
  if (exists) return { fieldErrors: { email: 'An account with this email already exists. Sign in instead.' } };
  const tenantId = newId();
  await db.insert(schema.tenants).values({ id: tenantId, name: parsed.data.company });
  try {
    await db.insert(schema.users).values({ id: newId(), tenantId, name: parsed.data.name, email: parsed.data.email, passwordHash: await bcrypt.hash(parsed.data.password, 12), role: 'owner' });
  } catch {
    await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
    return { fieldErrors: { email: 'An account with this email already exists. Sign in instead.' } };
  }
  try {
    await signIn('credentials', { email: parsed.data.email, password: parsed.data.password, redirectTo: '/onboarding' });
  } catch (e) {
    if (e instanceof AuthError) redirect('/login?created=1');
    throw e;
  }
}

const GENERIC_RESET_MSG = 'If an account exists for that email, a reset link is on its way. It expires in 1 hour.';

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ email }).safeParse({ email: fd.get('email') });
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
  const devMode = process.env.NODE_ENV !== 'production' || process.env.EVENTDESK_TEST === '1';
  if (!emailConfigured() && !devMode) return { error: 'Password reset emails are not set up on this server yet. Please contact your administrator.' };
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email)).limit(1);
  if (u) {
    const token = randomToken(32);
    await db.insert(schema.passwordResets).values({ id: newId(), userId: u.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600e3) });
    const link = `${await siteOrigin()}/reset-password?token=${token}`;
    if (emailConfigured()) {
      try {
        await sendEmail(u.email, 'Reset your EventDesk password',
          `<p>Hello ${u.name.replace(/[<>&]/g, '')},</p><p>Use the link below to choose a new password. It works once and expires in 1 hour.</p><p><a href="${link}">Reset my password</a></p><p>If you did not ask for this, you can ignore this email.</p>`,
          `Hello ${u.name},\n\nReset your EventDesk password: ${link}\n\nThe link works once and expires in 1 hour. If you did not ask for this, ignore this email.`);
      } catch (e) {
        console.error('[auth] reset email failed:', e);
        return { error: 'We could not send the email right now. Please try again in a few minutes.' };
      }
    } else {
      console.log(`[auth] password reset link for ${u.email}: ${link}`);
    }
  }
  return { ok: true, message: GENERIC_RESET_MSG };
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ token: z.string().min(10), password, confirm: z.string() })
    .refine(v => v.password === v.confirm, { path: ['confirm'], message: 'The passwords do not match.' })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const fe = zodFieldErrors(parsed.error.issues);
    return fe.token ? { error: 'This reset link is invalid. Ask for a new one.' } : { fieldErrors: fe };
  }
  const db = await getDb();
  const [r] = await db.update(schema.passwordResets).set({ usedAt: new Date() })
    .where(and(eq(schema.passwordResets.tokenHash, sha256(parsed.data.token)), isNull(schema.passwordResets.usedAt), gt(schema.passwordResets.expiresAt, new Date())))
    .returning();
  if (!r) return { error: 'This reset link has expired or was already used. Ask for a new one.' };
  await db.update(schema.users).set({ passwordHash: await bcrypt.hash(parsed.data.password, 12) }).where(eq(schema.users.id, r.userId));
  redirect('/login?reset=1');
}

export async function onboardingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, tenant } = await requireUser({ allowNoCompany: true });
  const parsed = z.object({
    name: z.string().trim().min(2, 'Enter your company name.').max(120),
    phone: z.string().trim().regex(/^[0-9+\s-]{10,15}$/, 'Enter a valid phone number.'),
    city: z.string().trim().min(2, 'Enter your city.').max(60),
    address: z.string().trim().max(300).optional().default(''),
    gstin: z.string().trim().toUpperCase().regex(/^$|^[0-9A-Z]{15}$/, 'GSTIN has 15 letters and numbers.').optional().default(''),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
  await db.update(schema.tenants).set(parsed.data).where(eq(schema.tenants.id, tenant.id));
  redirect('/dashboard');
}
