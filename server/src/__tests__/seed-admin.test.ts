/**
 * Unit tests for server/prisma/seed-admin.ts
 *
 * Tests verify:
 * - Fast-fail when required env vars are missing or empty
 * - Password is hashed with bcrypt (not stored plaintext)
 * - Prisma upsert is called with the correct shape
 * - Success log is emitted
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';

// ─── Fake Prisma ─────────────────────────────────────────────────────────────

function makeFakePrisma(upsertImpl?: ReturnType<typeof vi.fn>) {
  return {
    adminUser: {
      upsert: upsertImpl ?? vi.fn().mockResolvedValue({ id: 'admin-1', username: 'admin' }),
    },
  } as unknown as PrismaClient;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Dynamically import so each test group can manipulate process.env first.
async function importSeedAdmin() {
  // Bust the module cache so env reads happen fresh on each import.
  const mod = await import('../../prisma/seed-admin.js');
  return mod.seedAdmin;
}

// ─── Missing env vars ─────────────────────────────────────────────────────────

describe('seedAdmin — missing env vars', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env['ADMIN_USERNAME'];
    delete process.env['ADMIN_PASSWORD'];
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  it('throws when both ADMIN_USERNAME and ADMIN_PASSWORD are absent', async () => {
    const seedAdmin = await importSeedAdmin();
    const db = makeFakePrisma();
    await expect(seedAdmin(db)).rejects.toThrow(
      'Missing required env vars: ADMIN_USERNAME and ADMIN_PASSWORD must be set',
    );
  });

  it('throws when ADMIN_USERNAME is absent but ADMIN_PASSWORD is present', async () => {
    process.env['ADMIN_PASSWORD'] = 'secret123';
    const seedAdmin = await importSeedAdmin();
    const db = makeFakePrisma();
    await expect(seedAdmin(db)).rejects.toThrow(
      'Missing required env vars: ADMIN_USERNAME and ADMIN_PASSWORD must be set',
    );
  });

  it('throws when ADMIN_PASSWORD is absent but ADMIN_USERNAME is present', async () => {
    process.env['ADMIN_USERNAME'] = 'admin';
    const seedAdmin = await importSeedAdmin();
    const db = makeFakePrisma();
    await expect(seedAdmin(db)).rejects.toThrow(
      'Missing required env vars: ADMIN_USERNAME and ADMIN_PASSWORD must be set',
    );
  });

  it('throws when ADMIN_USERNAME is an empty string', async () => {
    process.env['ADMIN_USERNAME'] = '';
    process.env['ADMIN_PASSWORD'] = 'secret123';
    const seedAdmin = await importSeedAdmin();
    const db = makeFakePrisma();
    await expect(seedAdmin(db)).rejects.toThrow(
      'Missing required env vars: ADMIN_USERNAME and ADMIN_PASSWORD must be set',
    );
  });

  it('throws when ADMIN_PASSWORD is an empty string', async () => {
    process.env['ADMIN_USERNAME'] = 'admin';
    process.env['ADMIN_PASSWORD'] = '';
    const seedAdmin = await importSeedAdmin();
    const db = makeFakePrisma();
    await expect(seedAdmin(db)).rejects.toThrow(
      'Missing required env vars: ADMIN_USERNAME and ADMIN_PASSWORD must be set',
    );
  });
});

// ─── Successful seeding ───────────────────────────────────────────────────────

describe('seedAdmin — successful seeding', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env['ADMIN_USERNAME'] = 'admin';
    process.env['ADMIN_PASSWORD'] = 'supersecret99';
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('calls prisma.adminUser.upsert with the correct username', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'admin-1', username: 'admin' });
    const db = makeFakePrisma(upsert);
    const seedAdmin = await importSeedAdmin();

    await seedAdmin(db);

    expect(upsert).toHaveBeenCalledOnce();
    const call = upsert.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call.where).toEqual({ username: 'admin' });
    expect(call.create.username).toBe('admin');
    expect(call.update).toHaveProperty('passwordHash');
    expect(call.create).toHaveProperty('passwordHash');
  });

  it('stores a bcrypt hash, not the plaintext password', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'admin-1', username: 'admin' });
    const db = makeFakePrisma(upsert);
    const seedAdmin = await importSeedAdmin();

    await seedAdmin(db);

    const call = upsert.mock.calls[0]?.[0];
    const hash: string = call.create.passwordHash;

    // bcrypt hashes start with $2b$ (or $2a$) and are 60 chars long
    expect(hash).toMatch(/^\$2[ab]\$/);
    expect(hash).toHaveLength(60);
    expect(hash).not.toBe('supersecret99');
  });

  it('update and create contain the same hash value', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'admin-1', username: 'admin' });
    const db = makeFakePrisma(upsert);
    const seedAdmin = await importSeedAdmin();

    await seedAdmin(db);

    const call = upsert.mock.calls[0]?.[0];
    expect(call.create.passwordHash).toBe(call.update.passwordHash);
  });

  it('logs a success message containing the username', async () => {
    const db = makeFakePrisma();
    const seedAdmin = await importSeedAdmin();

    await seedAdmin(db);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('admin'),
    );
  });

  it('resolves to undefined (void) on success', async () => {
    const db = makeFakePrisma();
    const seedAdmin = await importSeedAdmin();

    await expect(seedAdmin(db)).resolves.toBeUndefined();
  });
});
