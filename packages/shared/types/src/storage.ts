export enum FileType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  AUDIO = 'AUDIO',
  OTHER = 'OTHER',
}

export interface FileMetadata {
  id: string;
  tenantId: string;
  resourceType?: string;
  resourceId?: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileType: FileType;
  size: number;
  url: string;
  uploadedBy?: string;
  createdAt: Date;
}

export interface UploadFileDTO {
  resourceType?: string;
  resourceId?: string;
  file: Express.Multer.File;
}

export interface FileFilter {
  resourceType?: string;
  resourceId?: string;
  fileType?: FileType;
  uploadedBy?: string;
}
