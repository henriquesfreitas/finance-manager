import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { AppPermission } from '../generated/prisma/client.js';

const fakePrisma = {
  portfolioComment: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock('../lib/prisma-client.js', () => ({ prisma: fakePrisma }));

const { createPortfolioCommentRouter } = await import('../routes/portfolio-comment-routes.js');
const { requirePermission } = await import('../middleware/permission-middleware.js');

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.permissions = (req.header('x-permissions')?.split(',') ?? ['INVESTMENTS']) as AppPermission[];
    next();
  });
  app.use('/api/investments', requirePermission('INVESTMENTS'));
  app.use('/api', createPortfolioCommentRouter());
  return app;
}

const now = new Date('2026-10-25T10:00:00.000Z');
const row = { id: 'note-1', content: 'Plan note', createdAt: now, updatedAt: now };

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('portfolio plan comment routes', () => {
  it('requires INVESTMENTS permission', async () => {
    const response = await request(buildApp()).get('/api/investments/plan-comments').set('x-permissions', 'BUDGET');
    expect(response.status).toBe(403);
    expect(fakePrisma.portfolioComment.findMany).not.toHaveBeenCalled();
  });

  it('lists comments newest first', async () => {
    fakePrisma.portfolioComment.findMany.mockResolvedValueOnce([row]);
    const response = await request(buildApp()).get('/api/investments/plan-comments');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ ...row, createdAt: now.toISOString(), updatedAt: now.toISOString() }]);
    expect(fakePrisma.portfolioComment.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
  });

  it('creates, updates, and deletes a note', async () => {
    fakePrisma.portfolioComment.create.mockResolvedValueOnce(row);
    fakePrisma.portfolioComment.update.mockResolvedValueOnce({ ...row, content: 'Updated plan' });
    fakePrisma.portfolioComment.delete.mockResolvedValueOnce(row);
    const app = buildApp();

    const created = await request(app).post('/api/investments/plan-comments').send({ content: 'Plan note' });
    const updated = await request(app).put('/api/investments/plan-comments/note-1').send({ content: 'Updated plan' });
    const deleted = await request(app).delete('/api/investments/plan-comments/note-1');

    expect(created.status).toBe(201);
    expect(updated.status).toBe(200);
    expect(updated.body.content).toBe('Updated plan');
    expect(deleted.status).toBe(204);
  });

  it('rejects empty and overlong note content', async () => {
    const app = buildApp();
    const empty = await request(app).post('/api/investments/plan-comments').send({ content: ' ' });
    const tooLong = await request(app).post('/api/investments/plan-comments').send({ content: 'x'.repeat(10001) });
    expect(empty.status).toBe(400);
    expect(tooLong.status).toBe(400);
  });
});
