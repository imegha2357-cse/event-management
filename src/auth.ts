import NextAuth, { CredentialsSignin } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq, or } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { newId } from '@/lib/util';

declare module 'next-auth' {
  interface Session { user: { id: string; tenantId: string; name: string; email: string } }
}

class InvalidLogin extends CredentialsSignin { code = 'invalid_credentials'; }

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

let dummyHash: string | undefined;
const credentialsSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

/** Finds the EventOS user for a Google account, linking by verified email or creating a new company. */
async function resolveGoogleUser(sub: string, email: string, name: string) {
  const db = await getDb();
  const [existing] = await db.select().from(schema.users).where(or(eq(schema.users.googleSub, sub), eq(schema.users.email, email))).limit(1);
  if (existing) {
    if (!existing.googleSub) await db.update(schema.users).set({ googleSub: sub }).where(eq(schema.users.id, existing.id));
    return existing;
  }
  const tenantId = newId();
  await db.insert(schema.tenants).values({ id: tenantId, name: '' });
  const user = { id: newId(), tenantId, name: name || email.split('@')[0], email, googleSub: sub, role: 'Owner' };
  await db.insert(schema.users).values(user);
  return { ...user, passwordHash: null, createdAt: new Date(), phone: '', active: true, platformAdmin: false };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    ...(googleEnabled ? [Google({ allowDangerousEmailAccountLinking: false })] : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidLogin();
        const db = await getDb();
        const [u] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email)).limit(1);
        // Always run a hash comparison so response time does not reveal whether the email exists.
        const hash = u?.passwordHash ?? (dummyHash ??= await bcrypt.hash('not-a-real-password', 12));
        const ok = await bcrypt.compare(parsed.data.password, hash);
        if (!u || !u.passwordHash || !ok || !u.active) throw new InvalidLogin();
        return { id: u.id, name: u.name, email: u.email };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'google') return Boolean(profile?.email && profile.email_verified);
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === 'google' && profile?.sub && profile.email) {
        const u = await resolveGoogleUser(profile.sub, profile.email.toLowerCase(), String(profile.name ?? ''));
        token.uid = u.id; token.tid = u.tenantId; token.name = u.name; token.email = u.email;
      } else if (user?.id) {
        const db = await getDb();
        const [u] = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
        token.uid = u.id; token.tid = u.tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = String(token.uid ?? '');
      session.user.tenantId = String(token.tid ?? '');
      return session;
    },
  },
});
