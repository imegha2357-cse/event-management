import 'server-only';
import * as schema from './schema';

/*
 * One database handle for the whole app.
 * - Production (Cloudflare Workers): DATABASE_URL is a Neon Postgres URL -> Neon serverless HTTP driver.
 * - Any other Postgres server (e.g. local development): node-postgres connection pool.
 */
type Handle = { db: any; ready: Promise<void> };
const g = globalThis as unknown as { __eventdeskDb?: Handle };

function make(): Handle {
  const url = process.env.DATABASE_URL ?? '';
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
  if (!host.endsWith('neon.tech') && process.env.DATABASE_DRIVER !== 'neon') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require('pg');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/node-postgres');
    const pool = new Pool({ connectionString: url, max: 10, ...(onWorkers ? { max: 1, idleTimeoutMillis: 500 } : {}) });
    return { db: drizzle(pool, { schema }), ready: Promise.resolve() };
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { neon } = require('@neondatabase/serverless');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/neon-http');
  return { db: drizzle(neon(url), { schema }), ready: Promise.resolve() };
}

/** Cloudflare Workers cannot reuse a TCP connection across requests, so a plain-Postgres pool is made per call there. */
const onWorkers = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';
const usesTcp = () => { const u = process.env.DATABASE_URL ?? ''; try { return !new URL(u).hostname.endsWith('neon.tech') && process.env.DATABASE_DRIVER !== 'neon'; } catch { return false; } };

export async function getDb() {
  if (onWorkers && usesTcp()) return make().db as import('drizzle-orm/neon-http').NeonHttpDatabase<typeof schema>;
  if (!g.__eventdeskDb) g.__eventdeskDb = make();
  await g.__eventdeskDb.ready;
  return g.__eventdeskDb.db as import('drizzle-orm/neon-http').NeonHttpDatabase<typeof schema>;
}

export { schema };
