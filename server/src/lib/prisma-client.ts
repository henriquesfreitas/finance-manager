import { PrismaClient } from '../generated/prisma/client.js';
import { createPrismaClient } from './create-prisma-client.js';

/**
 * Singleton Prisma client.
 * Using a module-level singleton prevents multiple connections during
 * hot-reload in development (tsx watch spawns the same module repeatedly).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
