import { BaseEvent } from './base';

export interface PostCreatedEvent extends BaseEvent {
  eventType: 'post.created';
  data: {
    postId: string;
    title: string;
    authorId: string;
    categoryId?: string;
  };
}

export interface PostUpdatedEvent extends BaseEvent {
  eventType: 'post.updated';
  data: {
    postId: string;
    changes: {
      title?: string;
      content?: string;
      categoryId?: string;
    };
  };
}

export interface PostDeletedEvent extends BaseEvent {
  eventType: 'post.deleted';
  data: {
    postId: string;
  };
}

export interface PostPublishedEvent extends BaseEvent {
  eventType: 'post.published';
  data: {
    postId: string;
    authorId: string;
  };
}
