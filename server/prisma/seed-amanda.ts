import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedAmanda } from './seed-admin.js';

const prisma = new PrismaClient();

seedAmanda(prisma)
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
