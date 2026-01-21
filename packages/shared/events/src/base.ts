export interface BaseEvent {
  eventId: string;
  eventType: string;
  tenantId: string;
  timestamp: Date;
  version: string;
}

export enum EventType {
  // User Events
  USER_REGISTERED = 'user.registered',
  USER_PROFILE_UPDATED = 'user.profile.updated',
  USER_DELETED = 'user.deleted',

  // Post Events
  POST_CREATED = 'post.created',
  POST_UPDATED = 'post.updated',
  POST_DELETED = 'post.deleted',
  POST_PUBLISHED = 'post.published',

  // Comment Events
  COMMENT_CREATED = 'comment.created',
  COMMENT_UPDATED = 'comment.updated',
  COMMENT_DELETED = 'comment.deleted',
  COMMENT_APPROVED = 'comment.approved',

  // Like Events
  LIKE_TOGGLED = 'like.toggled',

  // File Events
  FILE_UPLOADED = 'file.uploaded',
  FILE_DELETED = 'file.deleted',

  // Analytics Events
  PAGE_VIEW = 'analytics.page_view',
  USER_ACTION = 'analytics.user_action',
}
