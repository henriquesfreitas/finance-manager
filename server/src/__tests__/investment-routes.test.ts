import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { EnrichedInvestment, ArchivedInvestment } from '../types/order.js';
import type { InvestmentRecord } from '../types/investment.js';

// ─── Fake service ─────────────────────────────────────────────────────────────

/**
 * Named fake for the v2 investment service.
 * Only exposes the four methods that exist in v2 (no update, no delete).
 */
class FakeInvestmentService {
  listActiveInvestments = vi.fn<[], Promise<EnrichedInvestment[]>>();
  listArchivedInvestments = vi.fn<[], Promise<ArchivedInvestment[]>>();
  createInvestment = vi.fn<[object], Promise<InvestmentRecord>>();
  archiveInvestment = vi.fn<[string], Promise<InvestmentRecord>>();
}

// Mock the service module so the router uses our fake
vi.mock('../services/investment-service.js', () => ({
  createInvestmentService: vi.fn(() => fakeService),
}));

// Prisma is injected but not used directly in routes
vi.mock('../lib/prisma-client.js', () => ({ prisma: {} }));

let fakeService: FakeInvestmentService;

// Import the router AFTER mocks are registered (top-level await in ESM)
const { createInvestmentRouter } = await import('../routes/investment-routes.js');

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api', createInvestmentRouter());
  // Minimal error handler — mirrors the one in app.ts
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : 'Internal server error';
      res.status(500).json({ error: message });
    },
  );
  return app;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const RECORD: InvestmentRecord = {
  id: 'uuid-1',
  ticker: 'ITUB3',
  sector: 'Bancos',
  archivedAt: null,
  targetSellPrice: null,
  targetBuyPrice: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const ENRICHED: EnrichedInvestment = {
  ...RECORD,
  position: { quantity: '100.00000000', averagePrice: '28.35000000' },
  quote: { currentPrice: 29.5, dailyChangePercent: 1.2 },
};

const ARCHIVED: ArchivedInvestment = {
  ...RECORD,
  archivedAt: '2026-06-01T10:00:00.000Z',
  position: { quantity: '0.00000000', averagePrice: '0.00000000' },
};

// ─── GET /api/investments ─────────────────────────────────────────────────────

describe('GET /api/investments', () => {
  beforeEach(() => {
    fakeService = new FakeInvestmentService();
    vi.clearAllMocks();
  });

  it('returns 200 with an array of enriched investments', async () => {
    fakeService.listActiveInvestments.mockResolvedValueOnce([ENRICHED]);
    const app = buildApp();

    const res = await request(app).get('/api/investments');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].ticker).toBe('ITUB3');
    expect(res.body[0].position).toBeDefined();
  });

  it('returns 200 with an empty array when there are no active investments', async () => {
    fakeService.listActiveInvestments.mockResolvedValueOnce([]);
    const app = buildApp();

    const res = await request(app).get('/api/investments');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('propagates errors from the service to the error handler', async () => {
    fakeService.listActiveInvestments.mockRejectedValueOnce(new Error('DB connection lost'));
    const app = buildApp();

    const res = await request(app).get('/api/investments');

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/DB connection lost/);
  });
});

// ─── GET /api/investments/archived ───────────────────────────────────────────

describe('GET /api/investments/archived', () => {
  beforeEach(() => {
    fakeService = new FakeInvestmentService();
    vi.clearAllMocks();
  });

  it('returns 200 with an array of archived investments', async () => {
    fakeService.listArchivedInvestments.mockResolvedValueOnce([ARCHIVED]);
    const app = buildApp();

    const res = await request(app).get('/api/investments/archived');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].ticker).toBe('ITUB3');
    expect(res.body[0].archivedAt).toBeDefined();
    expect(res.body[0].position).toBeDefined();
  });

  it('returns 200 with an empty array when nothing is archived', async () => {
    fakeService.listArchivedInvestments.mockResolvedValueOnce([]);
    const app = buildApp();

    const res = await request(app).get('/api/investments/archived');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── POST /api/investments ────────────────────────────────────────────────────

describe('POST /api/investments', () => {
  beforeEach(() => {
    fakeService = new FakeInvestmentService();
    vi.clearAllMocks();
  });

  it('returns 201 with the created investment on valid ticker', async () => {
    fakeService.createInvestment.mockResolvedValueOnce(RECORD);
    const app = buildApp();

    const res = await request(app).post('/api/investments').send({ ticker: 'ITUB3', sector: 'Bancos' });

    expect(res.status).toBe(201);
    expect(res.body.ticker).toBe('ITUB3');
    expect(res.body.archivedAt).toBeNull();
  });

  it('uppercases the ticker before calling the service', async () => {
    fakeService.createInvestment.mockResolvedValueOnce({ ...RECORD, ticker: 'PETR4' });
    const app = buildApp();

    await request(app).post('/api/investments').send({ ticker: 'petr4', sector: 'Petróleo e Gás' });

    // The validator transforms to uppercase, so the service receives 'PETR4'
    expect(fakeService.createInvestment).toHaveBeenCalledWith({ ticker: 'PETR4', sector: 'Petróleo e Gás' });
  });

  it('returns 400 with validation errors when ticker is empty', async () => {
    const app = buildApp();

    const res = await request(app).post('/api/investments').send({ ticker: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toBeDefined();
  });

  it('returns 400 when ticker contains invalid characters', async () => {
    const app = buildApp();

    const res = await request(app).post('/api/investments').send({ ticker: 'IT UB3!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 400 when body is empty', async () => {
    const app = buildApp();

    const res = await request(app).post('/api/investments').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 409 when ticker is already registered', async () => {
    fakeService.createInvestment.mockRejectedValueOnce(
      new Error('Ticker "ITUB3" is already registered'),
    );
    const app = buildApp();

    const res = await request(app).post('/api/investments').send({ ticker: 'ITUB3', sector: 'Bancos' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/);
  });
});

// ─── PATCH /api/investments/:id/archive ──────────────────────────────────────

describe('PATCH /api/investments/:id/archive', () => {
  beforeEach(() => {
    fakeService = new FakeInvestmentService();
    vi.clearAllMocks();
  });

  it('returns 200 with the archived investment on success', async () => {
    const archivedRecord: InvestmentRecord = {
      ...RECORD,
      archivedAt: '2026-06-01T10:00:00.000Z',
    };
    fakeService.archiveInvestment.mockResolvedValueOnce(archivedRecord);
    const app = buildApp();

    const res = await request(app).patch('/api/investments/uuid-1/archive');

    expect(res.status).toBe(200);
    expect(res.body.archivedAt).toBeDefined();
    expect(fakeService.archiveInvestment).toHaveBeenCalledWith('uuid-1');
  });

  it('returns 404 when the investment does not exist', async () => {
    fakeService.archiveInvestment.mockRejectedValueOnce(
      new Error('Investment with id "nonexistent" not found'),
    );
    const app = buildApp();

    const res = await request(app).patch('/api/investments/nonexistent/archive');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/);
  });

  it('returns 409 when the investment is already archived', async () => {
    fakeService.archiveInvestment.mockRejectedValueOnce(
      new Error('Investment "ITUB3" is already archived'),
    );
    const app = buildApp();

    const res = await request(app).patch('/api/investments/uuid-1/archive');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already archived/);
  });
});

// ─── PUT /api/investments/:id — removed in v2, must return 405 ───────────────

describe('PUT /api/investments/:id', () => {
  beforeEach(() => {
    fakeService = new FakeInvestmentService();
    vi.clearAllMocks();
  });

  it('returns 405 with an explicit deprecation message', async () => {
    const app = buildApp();

    const res = await request(app)
      .put('/api/investments/uuid-1')
      .send({ ticker: 'ITUB3', quantity: 100, averagePrice: 28.35 });

    expect(res.status).toBe(405);
    expect(res.body.error).toMatch(/PUT method not allowed/);
    expect(res.body.error).toMatch(/order-derived/);
  });

  it('never calls the service when PUT is attempted', async () => {
    const app = buildApp();

    await request(app).put('/api/investments/uuid-1').send({ ticker: 'ITUB3' });

    // No service method should be called — the route is a stub
    expect(fakeService.createInvestment).not.toHaveBeenCalled();
    expect(fakeService.archiveInvestment).not.toHaveBeenCalled();
  });
});
