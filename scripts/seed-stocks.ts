/**
 * One-time seed script to populate the finance-manager database with
 * a portfolio of Brazilian stocks, FIIs, ETFs, BDRs, and Fiagros.
 *
 * Uses actual B3 position data (25/06/2026) with real order history
 * including bonuses from corporate events in 2025/2026.
 *
 * Usage:
 *   cd server
 *   npx tsx ../scripts/seed-stocks.ts
 *
 * Requirements:
 *   - Server must be running on localhost:3000
 *   - Database must be accessible
 */

const BASE_URL = 'http://localhost:3000';

type OrderType = 'BUY' | 'SELL' | 'BONUS' | 'SPLIT';

interface OrderEntry {
  type: OrderType;
  quantity: number;
  price: number;
  orderDate: string; // YYYY-MM-DD
}

interface StockEntry {
  ticker: string;
  sector: string;
  orders: OrderEntry[];
}

// ─── Portfolio Data ─────────────────────────────────────────────────────────

const stocks: StockEntry[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // BANCOS
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'ITUB3', sector: 'Bancos', orders: [
    { type: 'BUY', quantity: 859, price: 28.35, orderDate: '2026-07-19' },
    { type: 'BONUS', quantity: 25, price: 43.71, orderDate: '2026-06-19' },
  ]},
  { ticker: 'BBAS3', sector: 'Bancos', orders: [
    { type: 'BUY', quantity: 2100, price: 23.50, orderDate: '2026-07-19' },
  ]},
  { ticker: 'BBDC3', sector: 'Bancos', orders: [
    { type: 'BUY', quantity: 3343, price: 16.60, orderDate: '2026-07-19' },
  ]},
  { ticker: 'ITSA4', sector: 'Bancos', orders: [
    { type: 'BUY', quantity: 1169, price: 8.13, orderDate: '2026-07-19' },
    { type: 'BONUS', quantity: 39, price: 13.30, orderDate: '2026-06-19' },
  ]},
  { ticker: 'SANB11', sector: 'Bancos', orders: [
    { type: 'BUY', quantity: 300, price: 29.73, orderDate: '2026-07-19' },
  ]},
  { ticker: 'ABCB4', sector: 'Bancos', orders: [] },
  { ticker: 'BRSR6', sector: 'Bancos', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // SEGUROS
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'PSSA3', sector: 'Seguros', orders: [
    { type: 'BUY', quantity: 200, price: 19.22, orderDate: '2026-07-19' },
  ]},
  { ticker: 'BBSE3', sector: 'Seguros', orders: [
    { type: 'BUY', quantity: 100, price: 30.30, orderDate: '2026-07-19' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVIÇOS FINANCEIROS
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'B3SA3', sector: 'Serviços Financeiros', orders: [
    { type: 'BUY', quantity: 700, price: 10.91, orderDate: '2026-07-19' },
  ]},
  { ticker: 'XPBR31', sector: 'Serviços Financeiros', orders: [
    { type: 'BUY', quantity: 18, price: 220.00, orderDate: '2026-07-19' },
  ]},
  { ticker: 'CIEL3', sector: 'Serviços Financeiros', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENERGIA ELÉTRICA
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'EGIE3', sector: 'Energia Elétrica', orders: [
    { type: 'BUY', quantity: 450, price: 37.50, orderDate: '2026-07-19' },
    { type: 'BONUS', quantity: 180, price: 6.01, orderDate: '2025-11-26' },
  ]},
  { ticker: 'EQTL3', sector: 'Energia Elétrica', orders: [
    { type: 'BUY', quantity: 503, price: 26.63, orderDate: '2026-07-19' },
  ]},
  { ticker: 'CMIG3', sector: 'Energia Elétrica', orders: [
    { type: 'BUY', quantity: 600, price: 14.12, orderDate: '2026-07-19' },
  ]},
  { ticker: 'AXIA3', sector: 'Energia Elétrica', orders: [
    { type: 'BUY', quantity: 599, price: 34.77, orderDate: '2026-07-19' },
  ]},
  { ticker: 'AXIA7', sector: 'Energia Elétrica', orders: [
    { type: 'BUY', quantity: 157, price: 49.72, orderDate: '2026-07-19' },
  ]},
  { ticker: 'CPFE3', sector: 'Energia Elétrica', orders: [] },
  { ticker: 'TAEE11', sector: 'Energia Elétrica', orders: [] },
  { ticker: 'ENEV3', sector: 'Energia Elétrica', orders: [] },
  { ticker: 'AESB3', sector: 'Energia Elétrica', orders: [] },
  { ticker: 'AURE3', sector: 'Energia Elétrica', orders: [] },
  { ticker: 'TRPL4', sector: 'Energia Elétrica', orders: [] },
  { ticker: 'ALUP11', sector: 'Energia Elétrica', orders: [] },
  { ticker: 'CPLE3', sector: 'Energia Elétrica', orders: [] },
  { ticker: 'LIGT3', sector: 'Energia Elétrica', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // PETRÓLEO E GÁS
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'PETR3', sector: 'Petróleo e Gás', orders: [
    { type: 'BUY', quantity: 500, price: 18.14, orderDate: '2026-07-19' },
  ]},
  { ticker: 'CSAN3', sector: 'Petróleo e Gás', orders: [
    { type: 'BUY', quantity: 1300, price: 11.17, orderDate: '2026-07-19' },
  ]},
  { ticker: 'UGPA3', sector: 'Petróleo e Gás', orders: [] },
  { ticker: 'PRIO3', sector: 'Petróleo e Gás', orders: [] },
  { ticker: 'VBBR3', sector: 'Petróleo e Gás', orders: [] },
  { ticker: 'RRRP3', sector: 'Petróleo e Gás', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // MINERAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'VALE3', sector: 'Mineração', orders: [
    { type: 'BUY', quantity: 550, price: 45.00, orderDate: '2026-07-19' },
  ]},
  { ticker: 'CMIN3', sector: 'Mineração', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // SIDERURGIA E METALURGIA
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'GGBR3', sector: 'Siderurgia e Metalurgia', orders: [
    { type: 'BUY', quantity: 420, price: 16.27, orderDate: '2026-07-19' },
  ]},
  { ticker: 'USIM3', sector: 'Siderurgia e Metalurgia', orders: [] },
  { ticker: 'CSNA3', sector: 'Siderurgia e Metalurgia', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // PAPEL E CELULOSE
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'KLBN11', sector: 'Papel e Celulose', orders: [
    { type: 'BUY', quantity: 220, price: 19.73, orderDate: '2026-07-19' },
    { type: 'BONUS', quantity: 2, price: 12.95, orderDate: '2025-12-18' },
  ]},
  { ticker: 'SUZB3', sector: 'Papel e Celulose', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // AGRONEGÓCIO
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'SLCE3', sector: 'Agronegócio', orders: [
    { type: 'BUY', quantity: 300, price: 18.84, orderDate: '2026-07-19' },
    { type: 'BONUS', quantity: 37, price: 16.50, orderDate: '2026-01-02' },
  ]},
  { ticker: 'SOJA3', sector: 'Agronegócio', orders: [
    { type: 'BUY', quantity: 300, price: 10.27, orderDate: '2026-07-19' },
    { type: 'BUY', quantity: 200, price: 8.74, orderDate: '2025-12-08' },
    { type: 'BONUS', quantity: 24, price: 9.92, orderDate: '2025-12-15' },
  ]},
  { ticker: 'AGRO3', sector: 'Agronegócio', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // ALIMENTOS E BEBIDAS
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'ABEV3', sector: 'Alimentos e Bebidas', orders: [] },
  { ticker: 'MDIA3', sector: 'Alimentos e Bebidas', orders: [
    { type: 'BUY', quantity: 200, price: 40.47, orderDate: '2026-07-19' },
  ]},
  { ticker: 'BRFS3', sector: 'Alimentos e Bebidas', orders: [] },
  { ticker: 'JBS', sector: 'Alimentos e Bebidas', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // SAÚDE
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'SAUD3', sector: 'Saúde', orders: [
    { type: 'BUY', quantity: 500, price: 9.29, orderDate: '2026-07-19' },
  ]},
  { ticker: 'RADL3', sector: 'Saúde', orders: [
    { type: 'BUY', quantity: 203, price: 21.71, orderDate: '2026-07-19' },
    { type: 'BONUS', quantity: 4, price: 21.83, orderDate: '2025-12-23' },
  ]},
  { ticker: 'FLRY3', sector: 'Saúde', orders: [
    { type: 'BUY', quantity: 633, price: 14.55, orderDate: '2026-07-19' },
  ]},
  { ticker: 'RDOR3', sector: 'Saúde', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // VAREJO
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'LREN3', sector: 'Varejo', orders: [
    { type: 'BUY', quantity: 330, price: 17.18, orderDate: '2026-07-19' },
  ]},
  { ticker: 'AZZA3', sector: 'Varejo', orders: [
    { type: 'BUY', quantity: 100, price: 59.86, orderDate: '2026-07-19' },
  ]},
  { ticker: 'MGLU3', sector: 'Varejo', orders: [
    { type: 'BUY', quantity: 300, price: 18.54, orderDate: '2026-07-19' },
    { type: 'BONUS', quantity: 15, price: 10.83, orderDate: '2025-12-30' },
  ]},
  { ticker: 'VIVA3', sector: 'Varejo', orders: [
    { type: 'BUY', quantity: 100, price: 22.22, orderDate: '2026-07-19' },
  ]},
  { ticker: 'AUAU3', sector: 'Varejo', orders: [
    { type: 'BUY', quantity: 1000, price: 4.57, orderDate: '2026-07-19' },
  ]},
  { ticker: 'CVCB3', sector: 'Varejo', orders: [
    { type: 'BUY', quantity: 200, price: 6.90, orderDate: '2026-07-19' },
  ]},
  { ticker: 'CRFB3', sector: 'Varejo', orders: [] },
  { ticker: 'ASAI3', sector: 'Varejo', orders: [] },
  { ticker: 'SOMA3', sector: 'Varejo', orders: [] },
  { ticker: 'VIIA3', sector: 'Varejo', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // TECNOLOGIA
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'TOTS3', sector: 'Tecnologia', orders: [
    { type: 'BUY', quantity: 100, price: 24.46, orderDate: '2026-07-19' },
  ]},
  { ticker: 'CASH3', sector: 'Tecnologia', orders: [
    { type: 'BUY', quantity: 500, price: 3.86, orderDate: '2025-11-25' },
    { type: 'BUY', quantity: 300, price: 3.47, orderDate: '2026-02-09' },
  ]},
  { ticker: 'INTB3', sector: 'Tecnologia', orders: [] },
  { ticker: 'LWSA3', sector: 'Tecnologia', orders: [] },
  { ticker: 'MLAS3', sector: 'Tecnologia', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // EDUCAÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'YDUQ3', sector: 'Educação', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // INDÚSTRIA
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'WEGE3', sector: 'Indústria', orders: [
    { type: 'BUY', quantity: 100, price: 24.12, orderDate: '2026-07-19' },
  ]},
  { ticker: 'GRND3', sector: 'Indústria', orders: [
    { type: 'BUY', quantity: 1100, price: 8.16, orderDate: '2026-07-19' },
  ]},
  { ticker: 'FRAS3', sector: 'Indústria', orders: [] },
  { ticker: 'LEVE3', sector: 'Indústria', orders: [] },
  { ticker: 'KEPL3', sector: 'Indústria', orders: [] },
  { ticker: 'EMBR3', sector: 'Indústria', orders: [] },
  { ticker: 'TUPY3', sector: 'Indústria', orders: [] },
  { ticker: 'UNIP3', sector: 'Indústria', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUÇÃO CIVIL
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'EZTC3', sector: 'Construção Civil', orders: [
    { type: 'BUY', quantity: 942, price: 15.48, orderDate: '2026-07-19' },
    { type: 'BONUS', quantity: 255, price: 23.50, orderDate: '2025-12-10' },
  ]},
  { ticker: 'MULT3', sector: 'Construção Civil', orders: [
    { type: 'BUY', quantity: 200, price: 21.20, orderDate: '2026-07-19' },
  ]},
  { ticker: 'CYRE3', sector: 'Construção Civil', orders: [
    { type: 'BUY', quantity: 200, price: 18.90, orderDate: '2026-07-19' },
  ]},
  { ticker: 'CYRE4', sector: 'Construção Civil', orders: [
    { type: 'BONUS', quantity: 37, price: 34.33, orderDate: '2026-01-02' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSPORTE E LOGÍSTICA
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'RENT3', sector: 'Transporte e Logística', orders: [
    { type: 'BUY', quantity: 100, price: 41.96, orderDate: '2026-07-19' },
  ]},
  { ticker: 'RENT4', sector: 'Transporte e Logística', orders: [
    { type: 'BONUS', quantity: 3, price: 41.96, orderDate: '2025-12-30' },
  ]},
  { ticker: 'STBP3', sector: 'Transporte e Logística', orders: [] },
  { ticker: 'CCRO3', sector: 'Transporte e Logística', orders: [] },
  { ticker: 'RAIL3', sector: 'Transporte e Logística', orders: [] },
  { ticker: 'HBSA3', sector: 'Transporte e Logística', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // TELECOMUNICAÇÕES
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'VIVT3', sector: 'Telecomunicações', orders: [
    { type: 'BUY', quantity: 160, price: 25.37, orderDate: '2026-07-19' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // SANEAMENTO
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'SBSP3', sector: 'Saneamento', orders: [] },
  { ticker: 'SAPR11', sector: 'Saneamento', orders: [
    { type: 'BUY', quantity: 100, price: 17.65, orderDate: '2026-07-19' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // PETROQUÍMICOS
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'BRKM5', sector: 'Petroquímicos', orders: [] },
  { ticker: 'TASA3', sector: 'Petroquímicos', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // SEGUROS E RESSEGUROS
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'IRBR3', sector: 'Seguros e Resseguros', orders: [] },
  { ticker: 'CXSE3', sector: 'Seguros e Resseguros', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'ALOS3', sector: 'Utilidades', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // CRIPTOMOEDAS
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'OBTC3', sector: 'Criptomoedas', orders: [
    { type: 'BUY', quantity: 200, price: 6.85, orderDate: '2026-02-09' },
    { type: 'BUY', quantity: 100, price: 6.49, orderDate: '2026-02-23' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // BDRs
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'ROXO34', sector: 'BDRs', orders: [] },
  { ticker: 'BERK34', sector: 'BDRs', orders: [
    { type: 'BUY', quantity: 25, price: 80.25, orderDate: '2026-07-19' },
    { type: 'BUY', quantity: 10, price: 133.95, orderDate: '2025-12-08' },
    { type: 'BUY', quantity: 10, price: 130.25, orderDate: '2026-03-13' },
    { type: 'BUY', quantity: 10, price: 120.83, orderDate: '2026-04-10' },
    { type: 'BUY', quantity: 10, price: 118.83, orderDate: '2026-05-12' },
  ]},

  // ═══════════════════════════════════════════════════════════════════════════
  // ETFs
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'IVVB11', sector: 'ETFs', orders: [
    { type: 'BUY', quantity: 5, price: 229.55, orderDate: '2026-07-19' },
  ]},
  { ticker: 'GPUS11', sector: 'ETFs', orders: [
    { type: 'BUY', quantity: 10, price: 106.38, orderDate: '2026-03-13' },
    { type: 'BUY', quantity: 10, price: 103.40, orderDate: '2026-04-10' },
  ]},
  { ticker: 'NASD11', sector: 'ETFs', orders: [] },
  { ticker: 'USTK11', sector: 'ETFs', orders: [] },
  { ticker: 'XINA11', sector: 'ETFs', orders: [] },
  { ticker: 'WRLD11', sector: 'ETFs', orders: [] },
  { ticker: 'VWRA11', sector: 'ETFs', orders: [] },
  { ticker: 'KDIF11', sector: 'ETFs', orders: [] },
  { ticker: 'IFRA11', sector: 'ETFs', orders: [] },
  { ticker: 'JURO11', sector: 'ETFs', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // FIIs
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'HGLG11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 30, price: 164.99, orderDate: '2026-07-19' },
  ]},
  { ticker: 'KNRI11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 60, price: 142.25, orderDate: '2026-07-19' },
  ]},
  { ticker: 'FIIB11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 11, price: 462.83, orderDate: '2026-07-19' },
  ]},
  { ticker: 'VISC11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 114, price: 108.22, orderDate: '2026-07-19' },
  ]},
  { ticker: 'LVBI11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 80, price: 99.08, orderDate: '2026-07-19' },
  ]},
  { ticker: 'KNSC11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 299, price: 8.43, orderDate: '2026-07-19' },
  ]},
  { ticker: 'HGRE11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 100, price: 122.72, orderDate: '2026-07-19' },
  ]},
  { ticker: 'VRTA11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 40, price: 88.47, orderDate: '2026-07-19' },
  ]},
  { ticker: 'RCRB11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 90, price: 127.95, orderDate: '2026-07-19' },
  ]},
  { ticker: 'XPLG11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 65, price: 97.77, orderDate: '2026-07-19' },
  ]},
  { ticker: 'BCRI11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 150, price: 76.15, orderDate: '2026-07-19' },
  ]},
  { ticker: 'XPML11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 12, price: 98.59, orderDate: '2026-07-19' },
  ]},
  { ticker: 'MXRF11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 299, price: 9.28, orderDate: '2026-07-19' },
  ]},
  { ticker: 'RBVA11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 250, price: 12.50, orderDate: '2026-07-19' },
  ]},
  { ticker: 'TRBL11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 51, price: 92.78, orderDate: '2026-07-19' },
  ]},
  { ticker: 'HSML11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 75, price: 84.26, orderDate: '2026-07-19' },
  ]},
  { ticker: 'RBED11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 20, price: 123.00, orderDate: '2026-07-19' },
  ]},
  { ticker: 'VILG11', sector: 'FIIs', orders: [
    { type: 'BUY', quantity: 110, price: 95.68, orderDate: '2026-07-19' },
  ]},
  { ticker: 'HGRU11', sector: 'FIIs', orders: [] },
  { ticker: 'ALZR11', sector: 'FIIs', orders: [] },
  { ticker: 'RECR11', sector: 'FIIs', orders: [] },
  { ticker: 'MALL11', sector: 'FIIs', orders: [] },
  { ticker: 'XPIN11', sector: 'FIIs', orders: [] },
  { ticker: 'GGRC11', sector: 'FIIs', orders: [] },
  { ticker: 'HGPO11', sector: 'FIIs', orders: [] },
  { ticker: 'JSRE11', sector: 'FIIs', orders: [] },
  { ticker: 'LUGG11', sector: 'FIIs', orders: [] },
  { ticker: 'IRDM11', sector: 'FIIs', orders: [] },
  { ticker: 'VINO11', sector: 'FIIs', orders: [] },
  { ticker: 'MAXR11', sector: 'FIIs', orders: [] },
  { ticker: 'BBRC11', sector: 'FIIs', orders: [] },
  { ticker: 'BCFF11', sector: 'FIIs', orders: [] },
  { ticker: 'BTAL11', sector: 'FIIs', orders: [] },
  { ticker: 'CVBI11', sector: 'FIIs', orders: [] },
  { ticker: 'HFOF11', sector: 'FIIs', orders: [] },
  { ticker: 'HTMX11', sector: 'FIIs', orders: [] },
  { ticker: 'KNCR11', sector: 'FIIs', orders: [] },
  { ticker: 'HCTR11', sector: 'FIIs', orders: [] },
  { ticker: 'DEVA11', sector: 'FIIs', orders: [] },
  { ticker: 'IGTI11', sector: 'FIIs', orders: [] },

  // ═══════════════════════════════════════════════════════════════════════════
  // FIAGROS
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: 'KNCA11', sector: 'Fiagros', orders: [
    { type: 'BUY', quantity: 30, price: 95.08, orderDate: '2026-07-19' },
  ]},
  { ticker: 'RURA11', sector: 'Fiagros', orders: [] },
  { ticker: 'VGIA11', sector: 'Fiagros', orders: [] },
  { ticker: 'CPTR11', sector: 'Fiagros', orders: [] },
  { ticker: 'XPCA11', sector: 'Fiagros', orders: [] },
  { ticker: 'SNAG11', sector: 'Fiagros', orders: [] },
  { ticker: 'EGAF11', sector: 'Fiagros', orders: [] },
  { ticker: 'BTAG11', sector: 'Fiagros', orders: [] },
  { ticker: 'FGAA11', sector: 'Fiagros', orders: [] },
  { ticker: 'RZAG11', sector: 'Fiagros', orders: [] },
];

// ─── API helpers ──────────────────────────────────────────────────────────────

async function createInvestment(ticker: string, sector: string): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/api/investments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, sector }),
  });

  if (res.status === 201) {
    const data = (await res.json()) as { id: string };
    return data.id;
  }

  const errorBody = await res.text();
  if (errorBody.includes('unique') || errorBody.includes('already exists') || errorBody.includes('Unique')) {
    console.log(`  ⚠️  already exists, skipping...`);
    return null;
  }
  console.error(`  ❌ HTTP ${res.status} — ${errorBody}`);
  return null;
}

async function createOrder(
  investmentId: string,
  order: OrderEntry,
): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/investments/${investmentId}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: order.type,
      quantity: order.quantity,
      price: order.price,
      orderDate: order.orderDate,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`    ❌ Order failed (${order.type} ${order.quantity}×R$${order.price}): ${errorBody}`);
    return false;
  }
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🚀 Starting stock seed...\n');

  let created = 0;
  let skipped = 0;
  let ordersCreated = 0;
  let ordersFailed = 0;

  for (const stock of stocks) {
    process.stdout.write(`  📌 ${stock.ticker} (${stock.sector})`);

    const id = await createInvestment(stock.ticker, stock.sector);

    if (id === null) {
      skipped++;
      continue;
    }

    created++;

    if (stock.orders.length === 0) {
      console.log(' ✅ (watchlist)');
      continue;
    }

    // Sort orders by date ASC so BUY orders come before BONUS/SELL in chronological order
    const sortedOrders = [...stock.orders].sort((a, b) => a.orderDate.localeCompare(b.orderDate));

    let ordersSummary = '';
    for (const order of sortedOrders) {
      const success = await createOrder(id, order);
      if (success) {
        ordersCreated++;
        ordersSummary += ` +${order.type}(${order.quantity})`;
      } else {
        ordersFailed++;
      }
    }
    console.log(` ✅${ordersSummary}`);
  }

  console.log(`\n✨ Done!`);
  console.log(`   Investments created: ${created}`);
  console.log(`   Skipped (existing):  ${skipped}`);
  console.log(`   Orders created:      ${ordersCreated}`);
  console.log(`   Orders failed:       ${ordersFailed}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
