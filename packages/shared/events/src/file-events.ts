import { BaseEvent } from './base';
import { FileType } from '@shared/types';

export interface FileUploadedEvent extends BaseEvent {
  eventType: 'file.uploaded';
  data: {
    fileId: string;
    fileName: string;
    fileType: FileType;
    size: number;
    resourceType?: string;
    resourceId?: string;
    uploadedBy?: string;
  };
}

export interface FileDeletedEvent extends BaseEvent {
  eventType: 'file.deleted';
  data: {
    fileId: string;
    fileName: string;
  };
}
