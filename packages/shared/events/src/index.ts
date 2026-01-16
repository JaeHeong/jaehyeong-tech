export * from './base';
export * from './user-events';
export * from './post-events';
export * from './comment-events';
export * from './file-events';
export * from './analytics-events';
export * from './like-events';
export * from './page-events';

import {
  UserRegisteredEvent,
  UserProfileUpdatedEvent,
  UserDeletedEvent,
} from './user-events';
import { PostCreatedEvent, PostUpdatedEvent, PostDeletedEvent, PostPublishedEvent } from './post-events';
import {
  CommentCreatedEvent,
  CommentUpdatedEvent,
  CommentDeletedEvent,
  CommentApprovedEvent,
} from './comment-events';
import { FileUploadedEvent, FileDeletedEvent } from './file-events';
import { PageViewEvent, UserActionEvent } from './analytics-events';
import { LikeToggledEvent, PostLikedEvent, PostBookmarkedEvent } from './like-events';
import { PageCreatedEvent, PageUpdatedEvent, PageDeletedEvent } from './page-events';

export type Event =
  | UserRegisteredEvent
  | UserProfileUpdatedEvent
  | UserDeletedEvent
  | PostCreatedEvent
  | PostUpdatedEvent
  | PostDeletedEvent
  | PostPublishedEvent
  | CommentCreatedEvent
  | CommentUpdatedEvent
  | CommentDeletedEvent
  | CommentApprovedEvent
  | FileUploadedEvent
  | FileDeletedEvent
  | PageViewEvent
  | UserActionEvent
  | LikeToggledEvent
  | PostLikedEvent
  | PostBookmarkedEvent
  | PageCreatedEvent
  | PageUpdatedEvent
  | PageDeletedEvent;
