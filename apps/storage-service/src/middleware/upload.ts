import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { AppError } from './errorHandler';

// 메모리 스토리지 사용 (OCI에 바로 업로드)
const storage = multer.memoryStorage();

// 파일 필터
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'video/mp4',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`허용되지 않는 파일 타입입니다: ${file.mimetype}`, 400));
  }
};

// Multer 설정
export const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB default
  },
  fileFilter,
});

// 파일 타입 판별
export function getFileType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  if (mimeType === 'application/pdf' || mimeType.includes('document')) return 'DOCUMENT';
  return 'OTHER';
}

// 파일명 생성
export function generateFileName(originalName: string): string {
  const ext = path.extname(originalName);
  return `${crypto.randomUUID()}${ext}`;
}
