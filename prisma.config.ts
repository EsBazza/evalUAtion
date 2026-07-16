import { defineConfig } from '@prisma/config';

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
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
