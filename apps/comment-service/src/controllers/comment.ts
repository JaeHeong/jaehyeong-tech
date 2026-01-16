import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma';
import { eventPublisher } from '../services/eventPublisher';
import { AppError } from '../middleware/errorHandler';
import { hashIP, getClientIP } from '@shared/utils';
import { CommentStatus } from '@prisma/client';

/**
 * 댓글 생성
 * 인증된 사용자 또는 익명 사용자 모두 가능
 */
export async function createComment(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { resourceType, resourceId, content, guestName, guestEmail, parentId } = req.body;

    // 인증된 사용자인지 익명 사용자인지 확인
    const authorId = req.user?.id;

    if (!authorId && !guestName) {
      throw new AppError('인증되지 않은 경우 guestName이 필요합니다.', 400);
    }

    // IP 해싱 (스팸 방지)
    const ipHash = hashIP(getClientIP(req));

    // 댓글 생성
    const comment = await prisma.comment.create({
      data: {
        tenantId: tenant.id,
        resourceType,
        resourceId,
        content,
        authorId,
        guestName,
        guestEmail,
        parentId,
        ipHash,
        status: 'PENDING', // 기본값: 승인 대기
      },
      include: {
        parent: {
          select: {
            id: true,
            content: true,
          },
        },
      },
    });

    // 이벤트 발행
    await eventPublisher.publish({
      eventType: 'comment.created',
      tenantId: tenant.id,
      data: {
        commentId: comment.id,
        resourceType: comment.resourceType,
        resourceId: comment.resourceId,
        authorId: comment.authorId,
      },
    });

    res.status(201).json({
      data: {
        id: comment.id,
        resourceType: comment.resourceType,
        resourceId: comment.resourceId,
        content: comment.content,
        authorId: comment.authorId,
        guestName: comment.guestName,
        parentId: comment.parentId,
        status: comment.status,
        createdAt: comment.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 목록 조회
 * 특정 리소스의 댓글 목록
 */
export async function getComments(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { resourceType, resourceId, status, parentId } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const where: any = {
      tenantId: tenant.id,
      isDeleted: false,
    };

    if (resourceType) {
      where.resourceType = resourceType;
    }

    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (status) {
      where.status = status;
    } else {
      // 기본적으로 승인된 댓글만 표시
      where.status = 'APPROVED';
    }

    if (parentId === 'null' || parentId === null) {
      // 최상위 댓글만
      where.parentId = null;
    } else if (parentId) {
      // 특정 댓글의 대댓글
      where.parentId = parentId;
    }

    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        select: {
          id: true,
          content: true,
          authorId: true,
          guestName: true,
          status: true,
          parentId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              replies: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.comment.count({ where }),
    ]);

    res.json({
      data: comments,
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
 * 댓글 상세 조회
 */
export async function getComment(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { id } = req.params;

    const comment = await prisma.comment.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        parent: {
          select: {
            id: true,
            content: true,
          },
        },
        replies: {
          where: {
            isDeleted: false,
            status: 'APPROVED',
          },
          select: {
            id: true,
            content: true,
            authorId: true,
            guestName: true,
            status: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!comment) {
      throw new AppError('댓글을 찾을 수 없습니다.', 404);
    }

    res.json({ data: comment });
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 수정
 * 본인만 수정 가능
 */
export async function updateComment(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { id } = req.params;
    const { content } = req.body;

    // 댓글 조회
    const comment = await prisma.comment.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!comment) {
      throw new AppError('댓글을 찾을 수 없습니다.', 404);
    }

    // 권한 확인 (본인 또는 관리자만 수정 가능)
    if (comment.authorId && comment.authorId !== req.user?.id && req.user?.role !== 'ADMIN') {
      throw new AppError('댓글을 수정할 권한이 없습니다.', 403);
    }

    // 익명 댓글은 수정 불가 (보안상)
    if (!comment.authorId) {
      throw new AppError('익명 댓글은 수정할 수 없습니다.', 403);
    }

    // 댓글 수정
    const updated = await prisma.comment.update({
      where: { id },
      data: {
        content,
        status: 'PENDING', // 수정 시 다시 승인 대기
      },
    });

    // 이벤트 발행
    await eventPublisher.publish({
      eventType: 'comment.updated',
      tenantId: tenant.id,
      data: {
        commentId: updated.id,
        changes: {
          content,
          status: 'PENDING' as CommentStatus,
        },
      },
    });

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 삭제
 * 본인만 삭제 가능
 */
export async function deleteComment(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { id } = req.params;

    // 댓글 조회
    const comment = await prisma.comment.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!comment) {
      throw new AppError('댓글을 찾을 수 없습니다.', 404);
    }

    // 권한 확인
    if (comment.authorId && comment.authorId !== req.user?.id && req.user?.role !== 'ADMIN') {
      throw new AppError('댓글을 삭제할 권한이 없습니다.', 403);
    }

    // Soft delete
    await prisma.comment.update({
      where: { id },
      data: { isDeleted: true },
    });

    // 이벤트 발행
    await eventPublisher.publish({
      eventType: 'comment.deleted',
      tenantId: tenant.id,
      data: {
        commentId: comment.id,
        resourceType: comment.resourceType,
        resourceId: comment.resourceId,
      },
    });

    res.json({ message: '댓글이 삭제되었습니다.' });
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 승인 (관리자 전용)
 */
export async function approveComment(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { id } = req.params;

    const comment = await prisma.comment.update({
      where: {
        id,
        tenantId: tenant.id,
      },
      data: {
        status: 'APPROVED',
      },
    });

    // 이벤트 발행
    await eventPublisher.publish({
      eventType: 'comment.approved',
      tenantId: tenant.id,
      data: {
        commentId: comment.id,
        resourceType: comment.resourceType,
        resourceId: comment.resourceId,
      },
    });

    res.json({ data: comment });
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 거부/스팸 처리 (관리자 전용)
 */
export async function updateCommentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const { id } = req.params;
    const { status } = req.body;

    const comment = await prisma.comment.update({
      where: {
        id,
        tenantId: tenant.id,
      },
      data: {
        status,
      },
    });

    res.json({ data: comment });
  } catch (error) {
    next(error);
  }
}
