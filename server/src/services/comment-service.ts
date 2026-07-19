import type { PrismaClient } from '@prisma/client';
import type { CreateCommentInput, UpdateCommentInput, CommentRecord } from '../types/comment.js';

/** Converts a Prisma Comment row to the plain CommentRecord shape. */
function toCommentRecord(row: {
  id: string;
  investmentId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}): CommentRecord {
  return {
    id: row.id,
    investmentId: row.investmentId,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Comment service — all comment database access goes through here.
 *
 * @example
 *   const svc = createCommentService(prisma);
 *   const comments = await svc.listComments(investmentId);
 */
export function createCommentService(db: PrismaClient) {
  return {
    /**
     * Returns all comments for an investment, newest first.
     */
    async listComments(investmentId: string): Promise<CommentRecord[]> {
      const rows = await db.comment.findMany({
        where: { investmentId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(toCommentRecord);
    },

    /**
     * Creates a new comment for an investment.
     * Throws when the investment does not exist.
     */
    async createComment(
      investmentId: string,
      input: CreateCommentInput,
    ): Promise<CommentRecord> {
      const investment = await db.investment.findUnique({ where: { id: investmentId } });
      if (!investment) {
        throw new Error(`Investment with id "${investmentId}" not found`);
      }
      const row = await db.comment.create({
        data: { investmentId, content: input.content },
      });
      return toCommentRecord(row);
    },

    /**
     * Updates the content of an existing comment.
     * Throws when the comment is not found or doesn't belong to the investment.
     */
    async updateComment(
      investmentId: string,
      commentId: string,
      input: UpdateCommentInput,
    ): Promise<CommentRecord> {
      const existing = await db.comment.findUnique({ where: { id: commentId } });
      if (!existing || existing.investmentId !== investmentId) {
        throw new Error(`Comment with id "${commentId}" not found for this investment`);
      }
      const row = await db.comment.update({
        where: { id: commentId },
        data: { content: input.content },
      });
      return toCommentRecord(row);
    },

    /**
     * Deletes a comment.
     * Throws when the comment is not found or doesn't belong to the investment.
     */
    async deleteComment(investmentId: string, commentId: string): Promise<void> {
      const existing = await db.comment.findUnique({ where: { id: commentId } });
      if (!existing || existing.investmentId !== investmentId) {
        throw new Error(`Comment with id "${commentId}" not found for this investment`);
      }
      await db.comment.delete({ where: { id: commentId } });
    },
  };
}

export type CommentService = ReturnType<typeof createCommentService>;
