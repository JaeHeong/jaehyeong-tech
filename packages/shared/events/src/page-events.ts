import { BaseEvent } from './base';

export interface PageCreatedEvent extends BaseEvent {
  eventType: 'page.created';
  data: {
    pageId: string;
    title: string;
    slug: string;
    type: string;
  };
}

export interface PageUpdatedEvent extends BaseEvent {
  eventType: 'page.updated';
  data: {
    pageId: string;
    title?: string;
    slug?: string;
    type?: string;
  };
}

export interface PageDeletedEvent extends BaseEvent {
  eventType: 'page.deleted';
  data: {
    pageId: string;
    title: string;
  };
}
