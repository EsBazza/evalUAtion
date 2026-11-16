import { defineConfig } from '@prisma/config';

// Load environment variables from .env file
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // .env is optional (e.g. on Vercel, vars come from the project settings)
  }
}

// Prisma CLI commands (db push, migrate, studio) must use Neon's DIRECT (unpooled)
// connection — PgBouncer in transaction mode breaks schema operations.
// The app runtime (lib/prisma.ts) uses the pooled DATABASE_URL instead.
// DIRECT_URL is accepted too (the name used in older setups).
const cliUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!cliUrl) {
  throw new Error('Set DATABASE_URL_UNPOOLED (direct Neon URL) or DATABASE_URL in .env');
}

export default defineConfig({
  datasource: {
    url: cliUrl,
  },
});
