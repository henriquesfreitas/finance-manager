/**
 * Canonical list of investment sectors used across the app.
 * Must be kept in sync with INVESTMENT_SECTORS in server/src/validators/investment-validator.ts.
 * Server is the source of truth for validation; this copy drives the client dropdown.
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
  'Exploração de Imóveis',
  'FIIs',
  'FIIs — Tijolo',
  'FIIs — Papel',
  'FIIs — Misto',
  'Fiagros',
  'ETFs',
  'BDRs',
  'Renda Fixa',
  'Criptomoedas',
  'Utilidades',
] as const;

export type InvestmentSector = (typeof INVESTMENT_SECTORS)[number];

/** Options for new stock records; generic FIIs remains available for legacy edits only. */
export const CREATE_INVESTMENT_SECTORS = INVESTMENT_SECTORS.filter((sector) => sector !== 'FIIs');
