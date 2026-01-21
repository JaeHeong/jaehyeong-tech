import { BaseEvent } from './base';

export interface PageViewEvent extends BaseEvent {
  eventType: 'analytics.page_view';
  data: {
    userId?: string;
    path: string;
    referrer?: string;
    userAgent: string;
    ipHash: string;
  };
}

export interface UserActionEvent extends BaseEvent {
  eventType: 'analytics.user_action';
  data: {
    userId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, any>;
  };
}
