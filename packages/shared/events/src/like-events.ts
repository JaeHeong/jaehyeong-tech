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
