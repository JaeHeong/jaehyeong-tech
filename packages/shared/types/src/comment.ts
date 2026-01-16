export enum CommentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SPAM = 'SPAM',
}

export interface Comment {
  id: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  content: string;
  authorId?: string;
  authorName?: string;
  authorEmail?: string;
  ipHash: string;
  status: CommentStatus;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommentDTO {
  resourceType: string;
  resourceId: string;
  content: string;
  authorName?: string;
  authorEmail?: string;
  parentId?: string;
}

export interface UpdateCommentDTO {
  content?: string;
  status?: CommentStatus;
}

export interface CommentFilter {
  resourceType?: string;
  resourceId?: string;
  status?: CommentStatus;
  authorId?: string;
}
