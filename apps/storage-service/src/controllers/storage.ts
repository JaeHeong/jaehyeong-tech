import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import { prisma } from '../services/prisma';
import { ociStorage } from '../services/ociStorage';
import { eventPublisher } from '../services/eventPublisher';
import { AppError } from '../middleware/errorHandler';
import { getFileType, generateFileName } from '../middleware/upload';

/**
 * 파일 업로드
 */
export async function uploadFile(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const file = req.file;

    if (!file) {
      throw new AppError('파일이 제공되지 않았습니다.', 400);
    }

    const { resourceType, resourceId, folder = 'uploads' } = req.body;

    // 파일명 생성
    const fileName = generateFileName(file.originalname);
    const fileType = getFileType(file.mimetype);

    let buffer = file.buffer;
    let width: number | undefined;
    let height: number | undefined;

    // 이미지 파일인 경우 메타데이터 추출 및 최적화
    if (fileType === 'IMAGE') {
      try {
        const metadata = await sharp(buffer).metadata();
        width = metadata.width;
        height = metadata.height;

        // 이미지 최적화 (옵션)
        if (width && width > 2000) {
          buffer = await sharp(buffer).resize(2000, undefined, { withoutEnlargement: true }).toBuffer();

          const newMetadata = await sharp(buffer).metadata();
          width = newMetadata.width;
          height = newMetadata.height;
        }
      } catch (error) {
        console.warn('⚠️ Image processing failed, using original:', error);
      }
    }

    // OCI에 업로드
    const url = await ociStorage.uploadFile(tenant.name, folder, fileName, buffer, file.mimetype);

    const objectName = `${tenant.name}/${folder}/${fileName}`;

    // 메타데이터 저장
    const fileRecord = await prisma.file.create({
      data: {
        tenantId: tenant.id,
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        size: buffer.length,
        storageProvider: 'oci',
        storagePath: objectName,
        objectName,
        folder,
        url,
        resourceType,
        resourceId,
        fileType,
        width,
        height,
        uploadedBy: req.user?.id,
      },
    });

    // 이벤트 발행
    await eventPublisher.publish({
      eventType: 'file.uploaded',
      tenantId: tenant.id,
      data: {
        fileId: fileRecord.id,
        fileName: fileRecord.fileName,
        fileType: fileRecord.fileType,
        size: fileRecord.size,
        resourceType: fileRecord.resourceType,
        resourceId: fileRecord.resourceId,
        uploadedBy: fileRecord.uploadedBy,
      },
    });

    res.status(201).json({
      data: {
        id: fileRecord.id,
        fileName: fileRecord.fileName,
        originalFileName: fileRecord.originalFileName,
        mimeType: fileRecord.mimeType,
        size: fileRecord.size,
        url: fileRecord.url,
        fileType: fileRecord.fileType,
        width: fileRecord.width,
        height: fileRecord.height,
        createdAt: fileRecord.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 파일 목록 조회
 */
export async function getFiles(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { resourceType, resourceId, folder, fileType } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const where: any = {
      tenantId: tenant.id,
    };

    if (resourceType) {
      where.resourceType = resourceType;
    }

    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (folder) {
      where.folder = folder;
    }

    if (fileType) {
      where.fileType = fileType;
    }

    const skip = (page - 1) * limit;

    const [files, total] = await Promise.all([
      prisma.file.findMany({
        where,
        select: {
          id: true,
          fileName: true,
          originalFileName: true,
          mimeType: true,
          size: true,
          url: true,
          fileType: true,
          width: true,
          height: true,
          resourceType: true,
          resourceId: true,
          folder: true,
          createdAt: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.file.count({ where }),
    ]);

    res.json({
      data: files,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 파일 상세 조회
 */
export async function getFile(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { id } = req.params;

    const file = await prisma.file.findFirst({
      where: {
        id,
        tenantId: tenant.id,
      },
    });

    if (!file) {
      throw new AppError('파일을 찾을 수 없습니다.', 404);
    }

    res.json({ data: file });
  } catch (error) {
    next(error);
  }
}

/**
 * 파일 삭제
 */
export async function deleteFile(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { id } = req.params;

    // 파일 조회
    const file = await prisma.file.findFirst({
      where: {
        id,
        tenantId: tenant.id,
      },
    });

    if (!file) {
      throw new AppError('파일을 찾을 수 없습니다.', 404);
    }

    // 권한 확인 (업로드한 사용자 또는 관리자만 삭제 가능)
    if (file.uploadedBy && file.uploadedBy !== req.user?.id && req.user?.role !== 'ADMIN') {
      throw new AppError('파일을 삭제할 권한이 없습니다.', 403);
    }

    // OCI에서 삭제
    try {
      await ociStorage.deleteFile(file.objectName);
    } catch (error) {
      console.error('Failed to delete from OCI:', error);
      // OCI 삭제 실패해도 DB에서는 삭제
    }

    // DB에서 삭제
    await prisma.file.delete({
      where: { id },
    });

    // 이벤트 발행
    await eventPublisher.publish({
      eventType: 'file.deleted',
      tenantId: tenant.id,
      data: {
        fileId: file.id,
        fileName: file.fileName,
      },
    });

    res.json({ message: '파일이 삭제되었습니다.' });
  } catch (error) {
    next(error);
  }
}
