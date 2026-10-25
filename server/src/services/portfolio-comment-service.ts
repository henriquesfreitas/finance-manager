import type { PrismaClient } from '../generated/prisma/client.js';
import type { PortfolioCommentInput, PortfolioCommentRecord } from '../types/portfolio-comment.js';

function toRecord(row: {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}): PortfolioCommentRecord {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createPortfolioCommentService(db: PrismaClient) {
  return {
    async listComments(): Promise<PortfolioCommentRecord[]> {
      const rows = await db.portfolioComment.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map(toRecord);
    },

    async createComment(input: PortfolioCommentInput): Promise<PortfolioCommentRecord> {
      const row = await db.portfolioComment.create({ data: { content: input.content } });
      return toRecord(row);
    },

    async updateComment(id: string, input: PortfolioCommentInput): Promise<PortfolioCommentRecord> {
      const row = await db.portfolioComment.update({ where: { id }, data: { content: input.content } });
      return toRecord(row);
    },

    async deleteComment(id: string): Promise<void> {
      await db.portfolioComment.delete({ where: { id } });
    },
  };
}

export type PortfolioCommentService = ReturnType<typeof createPortfolioCommentService>;
