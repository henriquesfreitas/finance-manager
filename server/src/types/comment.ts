/**
 * Types for the comment domain.
 * Comments are free-text notes attached to an investment.
 */

/**
 * Validated input for creating a comment.
 */
export interface CreateCommentInput {
  content: string;
}

/**
 * Validated input for updating a comment.
 */
export interface UpdateCommentInput {
  content: string;
}

/**
 * Comment as stored in the database, serialised for JSON.
 */
export interface CommentRecord {
  id: string;
  investmentId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
