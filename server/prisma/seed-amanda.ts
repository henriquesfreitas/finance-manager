import 'dotenv/config';
import { createPrismaClient } from '../src/lib/create-prisma-client.js';
import { seedAmanda } from './seed-admin.js';

const prisma = createPrismaClient();

seedAmanda(prisma)
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
