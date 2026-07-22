/**
 * Admin credential seeder — hashes and upserts the admin user into admin_users.
 *
 * Reads ADMIN_USERNAME and ADMIN_PASSWORD from the environment (already loaded
 * by the tsx runner via .env).  Safe to re-run — uses upsert so a second seed
 * only updates the password hash rather than creating a duplicate row.
 *
 * Usage (standalone):
 *   node --import tsx/esm prisma/seed-admin.ts
 *
 * Typical usage: called from prisma/seed.ts as part of the full seed run.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const BCRYPT_COST_FACTOR = 12;

/**
 * Seeds the admin user from environment variables.
 *
 * @param prisma - A connected PrismaClient instance (injected by the caller so
 *                 the same connection is reused when called from seed.ts).
 * @throws If ADMIN_USERNAME or ADMIN_PASSWORD is missing or empty.
 *
 * @example
 *   await seedAdmin(prisma);
 */
export async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const username = process.env['ADMIN_USERNAME'];
  const password = process.env['ADMIN_PASSWORD'];

  if (!username || !password) {
    throw new Error(
      'Missing required env vars: ADMIN_USERNAME and ADMIN_PASSWORD must be set',
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);

  await prisma.adminUser.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });

  console.log(`Admin user "${username}" seeded successfully.`);
}
