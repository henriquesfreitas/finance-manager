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
  'FIIs',
  'Fiagros',
  'ETFs',
  'BDRs',
  'Renda Fixa',
  'Criptomoedas',
  'Utilidades',
] as const;

export type InvestmentSector = (typeof INVESTMENT_SECTORS)[number];
