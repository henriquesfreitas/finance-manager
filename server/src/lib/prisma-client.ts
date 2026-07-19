import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client.
 * Using a module-level singleton prevents multiple connections during
 * hot-reload in development (tsx watch spawns the same module repeatedly).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
