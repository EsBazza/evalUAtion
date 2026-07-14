import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
    // Note: directUrl for migrations is not yet supported in prisma.config.ts (Prisma 7.x).
    // Use the DATABASE_URL (pooled Supabase URL) for both runtime and migrations.
    // For running migrations directly, set DATABASE_URL to the direct URL temporarily.
  },
});
