import { BaseEvent } from './base';

export interface LikeToggledEvent extends BaseEvent {
  eventType: 'like.toggled';
  data: {
    userId: string;
    resourceType: string;
    resourceId: string;
    isLiked: boolean;
  };
}

export interface PostLikedEvent extends BaseEvent {
  eventType: 'post.liked';
  data: {
    postId: string;
    userId?: string;
    ipHash?: string;
    isLiked: boolean;
    likeCount: number;
  };
}

export interface PostBookmarkedEvent extends BaseEvent {
  eventType: 'post.bookmarked';
  data: {
    postId: string;
    userId: string;
    isBookmarked: boolean;
  };
}
