import { defineConfig, env } from '@prisma/config';

// Load environment variables from .env file
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch (e) {
    // Fallback if env file doesn't exist
  }
}

export default defineConfig({
  datasource: {
    url: env("DIRECT_URL"),
    // Note: directUrl for migrations is not yet supported in prisma.config.ts (Prisma 7.x).
    // Use the DATABASE_URL (pooled Supabase URL) for both runtime and migrations.
    // For running migrations directly, set DATABASE_URL to the direct URL temporarily.
  },
});
