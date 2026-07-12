import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
//
// Learn more:
// https://pris.ly/d/help/next-js-best-practices
const globalForPrisma = global as unknown as { prisma: PrismaClient }

// Dynamic Cache Buster for hot-reloading development client generation
if (process.env.NODE_ENV !== 'production' && globalForPrisma.prisma) {
  const hasScoreCache = 'scoreCache' in globalForPrisma.prisma;
  const hasAuditLog = 'auditLog' in globalForPrisma.prisma;
  if (!hasScoreCache || !hasAuditLog) {
    console.log("Purging Prisma Client cache to load new schema models...");
    globalForPrisma.prisma = undefined as any;
    if (typeof require !== 'undefined' && require.cache) {
      Object.keys(require.cache).forEach((key) => {
        if (key.includes('@prisma/client') || key.includes('.prisma/client')) {
          delete require.cache[key];
        }
      });
    }
  }
}

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
