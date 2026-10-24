import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export function createPrismaClient(): PrismaClient {
  const connectionString = process.env['DATABASE_URL'] ?? '';
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}
