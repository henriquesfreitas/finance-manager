import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCommentService } from '../services/comment-service.js';
import type { PrismaClient } from '@prisma/client';

// ─── Prisma fake helpers ────────────────────────────────────────────────────

function makeCommentRow(overrides: Partial<{
  id: string;
  investmentId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  const now = new Date('2026-07-01T10:00:00Z');
  return {
    id: overrides.id ?? 'comment-1',
    investmentId: overrides.investmentId ?? 'inv-1',
    content: overrides.content ?? 'Test comment',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function makeFakePrisma(overrides: {
  investmentFindUnique?: ReturnType<typeof vi.fn>;
  commentFindMany?: ReturnType<typeof vi.fn>;
  commentFindUnique?: ReturnType<typeof vi.fn>;
  commentCreate?: ReturnType<typeof vi.fn>;
  commentUpdate?: ReturnType<typeof vi.fn>;
  commentDelete?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    investment: {
      findUnique: overrides.investmentFindUnique ?? vi.fn().mockResolvedValue(null),
    },
    comment: {
      findMany: overrides.commentFindMany ?? vi.fn().mockResolvedValue([]),
      findUnique: overrides.commentFindUnique ?? vi.fn().mockResolvedValue(null),
      create: overrides.commentCreate ?? vi.fn().mockResolvedValue(makeCommentRow()),
      update: overrides.commentUpdate ?? vi.fn().mockResolvedValue(makeCommentRow()),
      delete: overrides.commentDelete ?? vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient;
}

// ─── listComments ───────────────────────────────────────────────────────────

describe('listComments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all comments for the investment newest first', async () => {
    const comments = [
      makeCommentRow({ id: 'c2', createdAt: new Date('2026-07-02') }),
      makeCommentRow({ id: 'c1', createdAt: new Date('2026-07-01') }),
    ];
    const db = makeFakePrisma({
      commentFindMany: vi.fn().mockResolvedValue(comments),
    });

    const svc = createCommentService(db);
    const result = await svc.listComments('inv-1');

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('c2');
  });

  it('returns empty array when no comments exist', async () => {
    const db = makeFakePrisma({ commentFindMany: vi.fn().mockResolvedValue([]) });
    const svc = createCommentService(db);

    const result = await svc.listComments('inv-1');
    expect(result).toEqual([]);
  });
});

// ─── createComment ──────────────────────────────────────────────────────────

describe('createComment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates and returns the comment record', async () => {
    const investment = { id: 'inv-1', ticker: 'ITUB3', archivedAt: null };
    const newComment = makeCommentRow({ content: 'Earnings look good' });
    const db = makeFakePrisma({
      investmentFindUnique: vi.fn().mockResolvedValue(investment),
      commentCreate: vi.fn().mockResolvedValue(newComment),
    });

    const svc = createCommentService(db);
    const result = await svc.createComment('inv-1', { content: 'Earnings look good' });

    expect(result.content).toBe('Earnings look good');
    expect(result.id).toBe('comment-1');
    expect(db.comment.create).toHaveBeenCalledWith({
      data: { investmentId: 'inv-1', content: 'Earnings look good' },
    });
  });

  it('throws when the investment does not exist', async () => {
    const db = makeFakePrisma({
      investmentFindUnique: vi.fn().mockResolvedValue(null),
    });

    const svc = createCommentService(db);
    await expect(
      svc.createComment('nonexistent', { content: 'test' }),
    ).rejects.toThrow('not found');
  });
});

// ─── updateComment ──────────────────────────────────────────────────────────

describe('updateComment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates and returns the comment', async () => {
    const existing = makeCommentRow({ investmentId: 'inv-1' });
    const updated = makeCommentRow({ content: 'Updated note' });
    const db = makeFakePrisma({
      commentFindUnique: vi.fn().mockResolvedValue(existing),
      commentUpdate: vi.fn().mockResolvedValue(updated),
    });

    const svc = createCommentService(db);
    const result = await svc.updateComment('inv-1', 'comment-1', { content: 'Updated note' });

    expect(result.content).toBe('Updated note');
    expect(db.comment.update).toHaveBeenCalledWith({
      where: { id: 'comment-1' },
      data: { content: 'Updated note' },
    });
  });

  it('throws when the comment does not exist', async () => {
    const db = makeFakePrisma({
      commentFindUnique: vi.fn().mockResolvedValue(null),
    });

    const svc = createCommentService(db);
    await expect(
      svc.updateComment('inv-1', 'nonexistent', { content: 'test' }),
    ).rejects.toThrow('not found');
  });

  it('throws when the comment belongs to a different investment', async () => {
    const comment = makeCommentRow({ investmentId: 'other-inv' });
    const db = makeFakePrisma({
      commentFindUnique: vi.fn().mockResolvedValue(comment),
    });

    const svc = createCommentService(db);
    await expect(
      svc.updateComment('inv-1', 'comment-1', { content: 'test' }),
    ).rejects.toThrow('not found');
  });
});

// ─── deleteComment ──────────────────────────────────────────────────────────

describe('deleteComment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the comment successfully', async () => {
    const existing = makeCommentRow({ investmentId: 'inv-1' });
    const db = makeFakePrisma({
      commentFindUnique: vi.fn().mockResolvedValue(existing),
      commentDelete: vi.fn().mockResolvedValue({}),
    });

    const svc = createCommentService(db);
    await expect(svc.deleteComment('inv-1', 'comment-1')).resolves.toBeUndefined();
    expect(db.comment.delete).toHaveBeenCalledWith({ where: { id: 'comment-1' } });
  });

  it('throws when the comment does not exist', async () => {
    const db = makeFakePrisma({
      commentFindUnique: vi.fn().mockResolvedValue(null),
    });

    const svc = createCommentService(db);
    await expect(
      svc.deleteComment('inv-1', 'nonexistent'),
    ).rejects.toThrow('not found');
  });

  it('throws when the comment belongs to a different investment', async () => {
    const comment = makeCommentRow({ investmentId: 'other-inv' });
    const db = makeFakePrisma({
      commentFindUnique: vi.fn().mockResolvedValue(comment),
    });

    const svc = createCommentService(db);
    await expect(
      svc.deleteComment('inv-1', 'comment-1'),
    ).rejects.toThrow('not found');
  });
});
