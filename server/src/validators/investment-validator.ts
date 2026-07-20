import { z } from 'zod';
import type {
  CreateInvestmentInput,
  CreateTreasuryInvestmentInput,
  UpdateTargetPricesInput,
  UpdateCurrentValueInput,
} from '../types/investment.js';

/**
 * Canonical list of allowed investment sectors.
 * Must be kept in sync with INVESTMENT_SECTORS in client/src/lib/investment-sectors.ts.
 * This is the authoritative copy — Zod validates against it on every API call.
 */
export const INVESTMENT_SECTORS = [
  'Bancos',
  'Seguros',
  'Seguros e Resseguros',
  'Serviços Financeiros',
  'Energia Elétrica',
  'Petróleo e Gás',
  'Petroquímicos',
  'Mineração',
  'Siderurgia e Metalurgia',
  'Papel e Celulose',
  'Agronegócio',
  'Alimentos e Bebidas',
  'Saúde',
  'Varejo',
  'Tecnologia',
  'Educação',
  'Indústria',
  'Construção Civil',
  'Transporte e Logística',
  'Telecomunicações',
  'Saneamento',
  'FIIs',
  'Fiagros',
  'ETFs',
  'BDRs',
  'Renda Fixa',
  'Criptomoedas',
  'Utilidades',
] as const;

export type InvestmentSector = (typeof INVESTMENT_SECTORS)[number];

/**
 * Zod schema for creating an investment (ticker + sector in v3).
 * Ticker is trimmed, validated, and uppercased at parse time so the DB
 * always stores canonical values (e.g. "itub3 " → "ITUB3").
 * Sector must be one of the allowed values from INVESTMENT_SECTORS.
 *
 * @example
 *   createInvestmentSchema.parse({ ticker: 'itub3', sector: 'Bancos' })
 *   // → { ticker: 'ITUB3', sector: 'Bancos' }
 */
export const createInvestmentSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1, 'ticker must not be empty')
    .max(20, 'ticker must be at most 20 characters')
    .regex(/^[A-Za-z0-9.\-]+$/, 'ticker must contain only letters, digits, dots, and hyphens')
    .transform((v) => v.toUpperCase()),
  sector: z.enum(INVESTMENT_SECTORS, {
    error: `sector must be one of: ${INVESTMENT_SECTORS.join(', ')}`,
  }),
});

export type CreateInvestmentSchemaInput = z.input<typeof createInvestmentSchema>;

/**
 * Parses and validates raw investment creation input.
 * Returns a discriminated-union result to avoid try/catch at the call site.
 *
 * @example
 *   const result = validateCreateInvestmentInput({ ticker: 'itub3', sector: 'Bancos' });
 *   if (result.success) { ... result.data.ticker // 'ITUB3' ... }
 *   else { ... result.errors // { sector: ['sector must be one of: ...'] } ... }
 */
export function validateCreateInvestmentInput(raw: unknown):
  | { success: true; data: CreateInvestmentInput }
  | { success: false; errors: Record<string, string[]> } {
  const parsed = createInvestmentSchema.safeParse(raw);

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  const errors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path.join('.') || '_root';
    (errors[field] ??= []).push(issue.message);
  }
  return { success: false, errors };
}

/**
 * Zod schema for updating the sector of an existing investment.
 *
 * @example
 *   updateSectorSchema.parse({ sector: 'Tecnologia' })
 */
export const updateSectorSchema = z.object({
  sector: z.enum(INVESTMENT_SECTORS, {
    error: `sector must be one of: ${INVESTMENT_SECTORS.join(', ')}`,
  }),
});

export function validateUpdateSectorInput(raw: unknown):
  | { success: true; data: { sector: InvestmentSector } }
  | { success: false; errors: Record<string, string[]> } {
  const parsed = updateSectorSchema.safeParse(raw);

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  const errors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path.join('.') || '_root';
    (errors[field] ??= []).push(issue.message);
  }
  return { success: false, errors };
}

/**
 * @deprecated Use `validateCreateInvestmentInput` instead.
 * Kept for backward compatibility with v1 routes.
 */
export const validateInvestmentInput = validateCreateInvestmentInput;

/**
 * Nullable positive price helper — accepts a positive number or null (to clear).
 */
const nullablePositivePrice = z
  .number({ error: 'must be a number' })
  .positive('must be greater than 0')
  .nullable();

/**
 * Zod schema for updating target buy/sell prices.
 * Both fields are optional; send only the ones you want to change.
 * Passing null explicitly clears a previously set target.
 *
 * @example
 *   updateTargetPricesSchema.parse({ targetSellPrice: 35.5, targetBuyPrice: null })
 */
export const updateTargetPricesSchema = z.object({
  targetSellPrice: nullablePositivePrice.optional(),
  targetBuyPrice: nullablePositivePrice.optional(),
});

/**
 * Parses and validates raw target-price update input.
 *
 * @example
 *   const result = validateUpdateTargetPricesInput({ targetSellPrice: 35.5 });
 *   if (result.success) { ... result.data.targetSellPrice // 35.5 ... }
 */
export function validateUpdateTargetPricesInput(raw: unknown):
  | { success: true; data: UpdateTargetPricesInput }
  | { success: false; errors: Record<string, string[]> } {
  const parsed = updateTargetPricesSchema.safeParse(raw);

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  const errors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path.join('.') || '_root';
    (errors[field] ??= []).push(issue.message);
  }
  return { success: false, errors };
}

/**
 * Zod schema for creating a new TREASURY investment.
 * Only requires the id of an existing TreasuryProduct row.
 *
 * @example
 *   createTreasuryInvestmentSchema.parse({ treasuryProductId: 'some-uuid' })
 */
export const createTreasuryInvestmentSchema = z.object({
  treasuryProductId: z
    .string({ error: 'treasuryProductId must be a string' })
    .uuid('treasuryProductId must be a valid UUID'),
});

/**
 * Parses and validates raw treasury investment creation input.
 *
 * @example
 *   const result = validateCreateTreasuryInvestmentInput({ treasuryProductId: 'uuid' });
 *   if (result.success) { ... result.data.treasuryProductId ... }
 */
export function validateCreateTreasuryInvestmentInput(raw: unknown):
  | { success: true; data: CreateTreasuryInvestmentInput }
  | { success: false; errors: Record<string, string[]> } {
  const parsed = createTreasuryInvestmentSchema.safeParse(raw);

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  const errors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path.join('.') || '_root';
    (errors[field] ??= []).push(issue.message);
  }
  return { success: false, errors };
}

/**
 * Zod schema for updating the manual current value of a non-STOCK investment.
 * Accepts a positive number or null (to clear).
 *
 * @example
 *   updateCurrentValueSchema.parse({ currentValue: 30882.59 })
 *   updateCurrentValueSchema.parse({ currentValue: null })
 */
export const updateCurrentValueSchema = z.object({
  currentValue: z
    .number({ error: 'currentValue must be a number' })
    .positive('currentValue must be greater than 0')
    .nullable(),
});

/**
 * Parses and validates raw current-value update input.
 *
 * @example
 *   const result = validateUpdateCurrentValueInput({ currentValue: 30882.59 });
 *   if (result.success) { ... result.data.currentValue // 30882.59 ... }
 */
export function validateUpdateCurrentValueInput(raw: unknown):
  | { success: true; data: UpdateCurrentValueInput }
  | { success: false; errors: Record<string, string[]> } {
  const parsed = updateCurrentValueSchema.safeParse(raw);

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  const errors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path.join('.') || '_root';
    (errors[field] ??= []).push(issue.message);
  }
  return { success: false, errors };
}
