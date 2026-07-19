/**
 * DB reset script — deletes all investments.
 * Used by E2E tests via the /api/test/reset endpoint (test-only route).
 * Run directly: npx tsx src/scripts/reset-db.ts
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma-client.js';

async function main(): Promise<void> {
  const deleted = await prisma.investment.deleteMany({});
  console.log(`Deleted ${deleted.count} investments.`);
}

main()
  .catch((err: unknown) => {
    console.error('Reset failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
