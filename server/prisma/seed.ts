/**
 * Prisma seed script — populates the treasury_products catalog.
 * Run with: node --import tsx/esm prisma/seed.ts
 * (or via `npm run db:seed` defined in package.json)
 *
 * Safe to re-run — uses upsert so existing rows are not duplicated.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TREASURY_PRODUCTS = [
  { name: 'IPCA+ 2026',              slug: 'TESOURO-IPCA-2026' },
  { name: 'IPCA+ 2029',              slug: 'TESOURO-IPCA-2029' },
  { name: 'IPCA+ 2032',              slug: 'TESOURO-IPCA-2032' },
  { name: 'IPCA+ 2035',              slug: 'TESOURO-IPCA-2035' },
  { name: 'IPCA+ 2040',              slug: 'TESOURO-IPCA-2040' },
  { name: 'IPCA+ 2045',              slug: 'TESOURO-IPCA-2045' },
  { name: 'IPCA+ 2050',              slug: 'TESOURO-IPCA-2050' },
  { name: 'IPCA+ 2055',              slug: 'TESOURO-IPCA-2055' },
  { name: 'Pre 2026',                slug: 'TESOURO-PREFIXADO-2026' },
  { name: 'Pre 2029',                slug: 'TESOURO-PREFIXADO-2029' },
  { name: 'Pre 2031',                slug: 'TESOURO-PREFIXADO-2031' },
  { name: 'Selic 2026',              slug: 'TESOURO-SELIC-2026' },
  { name: 'Selic 2029',              slug: 'TESOURO-SELIC-2029' },
  { name: 'Renda+ 2030',             slug: 'TESOURO-RENDA-APOSENTADORIA-2030' },
  { name: 'Renda+ 2035',             slug: 'TESOURO-RENDA-APOSENTADORIA-2035' },
  { name: 'Renda+ 2040',             slug: 'TESOURO-RENDA-APOSENTADORIA-2040' },
  { name: 'Renda+ 2045',             slug: 'TESOURO-RENDA-APOSENTADORIA-2045' },
  { name: 'Renda+ 2050',             slug: 'TESOURO-RENDA-APOSENTADORIA-2050' },
  { name: 'Renda+ 2055',             slug: 'TESOURO-RENDA-APOSENTADORIA-2055' },
  { name: 'Renda+ 2060',             slug: 'TESOURO-RENDA-APOSENTADORIA-2060' },
  { name: 'Renda+ 2065',             slug: 'TESOURO-RENDA-APOSENTADORIA-2065' },
];

async function main(): Promise<void> {
  console.log('Seeding treasury products…');

  for (const product of TREASURY_PRODUCTS) {
    await prisma.treasuryProduct.upsert({
      where: { slug: product.slug },
      update: { name: product.name },
      create: { name: product.name, slug: product.slug },
    });
  }

  const count = await prisma.treasuryProduct.count();
  console.log(`Done. ${count} treasury products in catalog.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
