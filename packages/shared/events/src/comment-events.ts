import { BaseEvent } from './base';
import { CommentStatus } from '@shared/types';

export interface CommentCreatedEvent extends BaseEvent {
  eventType: 'comment.created';
  data: {
    commentId: string;
    resourceType: string;
    resourceId: string;
    authorId?: string;
  };
}

export interface CommentUpdatedEvent extends BaseEvent {
  eventType: 'comment.updated';
  data: {
    commentId: string;
    changes: {
      content?: string;
      status?: CommentStatus;
    };
  };
}

export interface CommentDeletedEvent extends BaseEvent {
  eventType: 'comment.deleted';
  data: {
    commentId: string;
    resourceType: string;
    resourceId: string;
  };
}

export interface CommentApprovedEvent extends BaseEvent {
  eventType: 'comment.approved';
  data: {
    commentId: string;
    resourceType: string;
    resourceId: string;
  };
}
