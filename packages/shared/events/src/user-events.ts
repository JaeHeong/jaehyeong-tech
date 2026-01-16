import { BaseEvent } from './base';
import { UserRole } from '@shared/types';

export interface UserRegisteredEvent extends BaseEvent {
  eventType: 'user.registered';
  data: {
    userId: string;
    email: string;
    username: string;
    role: UserRole;
  };
}

export interface UserProfileUpdatedEvent extends BaseEvent {
  eventType: 'user.profile.updated';
  data: {
    userId: string;
    changes: {
      username?: string;
      profileImage?: string;
      role?: UserRole;
    };
  };
}

export interface UserDeletedEvent extends BaseEvent {
  eventType: 'user.deleted';
  data: {
    userId: string;
  };
}
