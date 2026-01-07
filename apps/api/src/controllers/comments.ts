import type { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '../services/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { AuthRequest } from '../middleware/auth.js'

// Hash IP address for spam prevention
function hashIP(ip: string): string {
  const salt = process.env.IP_HASH_SALT || 'default-salt-change-in-production'
  return crypto.createHash('sha256').update(ip + salt).digest('hex')
}

function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

// Format comment for response
function formatComment(comment: {
  id: string
  content: string
  postId: string
  authorId: string | null
  guestName: string | null
  parentId: string | null
  isPrivate: boolean
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
  author?: { id: string; name: string; avatar: string | null } | null
  replies?: unknown[]
  _count?: { replies: number }
}, _isAdmin: boolean, currentUserId?: string) {
  // If deleted, show placeholder
  if (comment.isDeleted) {
    return {
      id: comment.id,
      content: '삭제된 댓글입니다.',
      postId: comment.postId,
      parentId: comment.parentId,
      isDeleted: true,
      isPrivate: false,
      author: null,
      guestName: null,
      createdAt: comment.createdAt.toISOString(),
      replyCount: comment._count?.replies || 0,
    }
  }

  // Determine author info
  const authorInfo = comment.author
    ? { id: comment.author.id, name: comment.author.name, avatar: comment.author.avatar }
    : null
  const guestName = comment.guestName || null

  return {
    id: comment.id,
    content: comment.content,
    postId: comment.postId,
    parentId: comment.parentId,
    isPrivate: comment.isPrivate,
    isDeleted: false,
    author: authorInfo,
    guestName,
    isOwner: comment.authorId === currentUserId,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    replyCount: comment._count?.replies || 0,
    replies: comment.replies,
  }
}

// Get comments for a post
export async function getComments(req: Request, res: Response, next: NextFunction) {
  try {
    const { postId } = req.params
    if (!postId) {
      throw new AppError('게시글 ID가 필요합니다.', 400)
    }
    const authReq = req as AuthRequest
    const isAdmin = authReq.user?.role === 'ADMIN'
    const currentUserId = authReq.user?.id

    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    })

    if (!post) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404)
    }

    // Build where clause
    const whereClause: {
      postId: string
      parentId: null
      isPrivate?: boolean
      OR?: Array<{ isPrivate: boolean } | { authorId: string }>
    } = {
      postId,
      parentId: null, // Only top-level comments
    }

    // Filter private comments unless admin or author
    if (!isAdmin) {
      if (currentUserId) {
        whereClause.OR = [
          { isPrivate: false },
          { authorId: currentUserId },
        ]
      } else {
        whereClause.isPrivate = false
      }
    }

    const comments = await prisma.comment.findMany({
      where: whereClause,
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        replies: {
          where: isAdmin
            ? {}
            : currentUserId
              ? { OR: [{ isPrivate: false }, { authorId: currentUserId }] }
              : { isPrivate: false },
          include: {
            author: { select: { id: true, name: true, avatar: true } },
            _count: { select: { replies: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Format comments with nested replies
    const formattedComments = comments.map((comment) => {
      const formatted = formatComment(comment, isAdmin, currentUserId)
      if (comment.replies) {
        formatted.replies = comment.replies.map((reply) =>
          formatComment(reply as typeof comment, isAdmin, currentUserId)
        )
      }
      return formatted
    })

    // Get total count (admin sees all, others see only public)
    const totalCount = await prisma.comment.count({
      where: {
        postId,
        isDeleted: false,
        ...(isAdmin ? {} : { isPrivate: false }),
      },
    })

    res.json({
      data: {
        comments: formattedComments,
        totalCount,
      },
    })
  } catch (error) {
    next(error)
  }
}

// Create a comment
export async function createComment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { postId } = req.params
    if (!postId) {
      throw new AppError('게시글 ID가 필요합니다.', 400)
    }
    const { content, guestName, guestPassword, parentId, isPrivate } = req.body

    // Verify post exists and is published
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    })

    if (!post) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404)
    }

    if (post.status !== 'PUBLIC') {
      throw new AppError('비공개 게시글에는 댓글을 작성할 수 없습니다.', 403)
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      throw new AppError('댓글 내용을 입력해주세요.', 400)
    }

    if (content.length > 2000) {
      throw new AppError('댓글은 2000자를 초과할 수 없습니다.', 400)
    }

    // Private comments require login
    if (isPrivate && !req.user) {
      throw new AppError('비공개 댓글은 로그인 후 작성할 수 있습니다.', 401)
    }

    // Validate parent comment if replying
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, postId: true, parentId: true, isDeleted: true },
      })

      if (!parentComment || parentComment.postId !== postId) {
        throw new AppError('원본 댓글을 찾을 수 없습니다.', 404)
      }

      if (parentComment.isDeleted) {
        throw new AppError('삭제된 댓글에는 답글을 작성할 수 없습니다.', 400)
      }

      // Prevent nested replies (only allow replies to top-level comments)
      if (parentComment.parentId) {
        throw new AppError('대댓글에는 답글을 작성할 수 없습니다.', 400)
      }
    }

    // Prepare comment data
    const commentData: {
      content: string
      postId: string
      parentId?: string
      isPrivate: boolean
      ipHash: string
      authorId?: string
      guestName?: string
      guestPassword?: string
    } = {
      content: content.trim(),
      postId,
      isPrivate: isPrivate || false,
      ipHash: hashIP(getClientIP(req)),
    }

    if (parentId) {
      commentData.parentId = parentId
    }

    // Check if logged in user
    if (req.user) {
      commentData.authorId = req.user.id
    } else {
      // Anonymous user - require name and password
      if (!guestName || guestName.trim().length === 0) {
        throw new AppError('이름을 입력해주세요.', 400)
      }
      if (!guestPassword || guestPassword.length < 4) {
        throw new AppError('비밀번호는 4자 이상이어야 합니다.', 400)
      }

      commentData.guestName = guestName.trim()
      commentData.guestPassword = await bcrypt.hash(guestPassword, 10)
    }

    const comment = await prisma.comment.create({
      data: commentData,
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        _count: { select: { replies: true } },
      },
    })

    const isAdmin = req.user?.role === 'ADMIN'
    const formatted = formatComment(comment, isAdmin, req.user?.id)

    res.status(201).json({ data: formatted })
  } catch (error) {
    next(error)
  }
}

// Update a comment
export async function updateComment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const { content, guestPassword, isPrivate } = req.body

    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    })

    if (!comment) {
      throw new AppError('댓글을 찾을 수 없습니다.', 404)
    }

    if (comment.isDeleted) {
      throw new AppError('삭제된 댓글은 수정할 수 없습니다.', 400)
    }

    // Check permission
    const isAdmin = req.user?.role === 'ADMIN'
    const isOwner = comment.authorId === req.user?.id

    if (!isAdmin && !isOwner) {
      // For anonymous comments, verify password
      if (comment.guestPassword) {
        if (!guestPassword) {
          throw new AppError('비밀번호를 입력해주세요.', 400)
        }
        const isValid = await bcrypt.compare(guestPassword, comment.guestPassword)
        if (!isValid) {
          throw new AppError('비밀번호가 일치하지 않습니다.', 403)
        }
      } else {
        throw new AppError('수정 권한이 없습니다.', 403)
      }
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      throw new AppError('댓글 내용을 입력해주세요.', 400)
    }

    if (content.length > 2000) {
      throw new AppError('댓글은 2000자를 초과할 수 없습니다.', 400)
    }

    const updateData: { content: string; isPrivate?: boolean } = {
      content: content.trim(),
    }

    // Only allow isPrivate change for owner or admin
    if (isPrivate !== undefined && (isAdmin || isOwner)) {
      updateData.isPrivate = isPrivate
    }

    const updated = await prisma.comment.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        _count: { select: { replies: true } },
      },
    })

    const formatted = formatComment(updated, isAdmin, req.user?.id)

    res.json({ data: formatted })
  } catch (error) {
    next(error)
  }
}

// Delete a comment (soft delete)
export async function deleteComment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const { guestPassword } = req.body || {}

    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        _count: { select: { replies: true } },
      },
    })

    if (!comment) {
      throw new AppError('댓글을 찾을 수 없습니다.', 404)
    }

    if (comment.isDeleted) {
      throw new AppError('이미 삭제된 댓글입니다.', 400)
    }

    // Check permission
    const isAdmin = req.user?.role === 'ADMIN'
    const isOwner = comment.authorId === req.user?.id

    if (!isAdmin && !isOwner) {
      // For anonymous comments, verify password
      if (comment.guestPassword) {
        if (!guestPassword) {
          throw new AppError('비밀번호를 입력해주세요.', 400)
        }
        const isValid = await bcrypt.compare(guestPassword, comment.guestPassword)
        if (!isValid) {
          throw new AppError('비밀번호가 일치하지 않습니다.', 403)
        }
      } else {
        throw new AppError('삭제 권한이 없습니다.', 403)
      }
    }

    // If has replies, soft delete (keep for reply context)
    // If no replies, hard delete
    if (comment._count.replies > 0) {
      await prisma.comment.update({
        where: { id },
        data: {
          isDeleted: true,
          content: '',
          guestName: null,
          guestPassword: null,
        },
      })
    } else {
      await prisma.comment.delete({ where: { id } })
    }

    res.json({
      data: {
        success: true,
        message: '댓글이 삭제되었습니다.',
      },
    })
  } catch (error) {
    next(error)
  }
}

// Admin: Get all comments (for management)
export async function getAllComments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const includeDeleted = req.query.includeDeleted === 'true'

    const whereClause = includeDeleted ? {} : { isDeleted: false }

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: whereClause,
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          post: { select: { id: true, title: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.comment.count({ where: whereClause }),
    ])

    res.json({
      data: comments.map((c) => ({
        id: c.id,
        content: c.isDeleted ? '삭제된 댓글입니다.' : c.content,
        isPrivate: c.isPrivate,
        isDeleted: c.isDeleted,
        author: c.author,
        guestName: c.guestName,
        post: c.post,
        parentId: c.parentId,
        createdAt: c.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    next(error)
  }
}

// Admin: Hard delete a comment
export async function adminDeleteComment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    const { id } = req.params

    const comment = await prisma.comment.findUnique({
      where: { id },
    })

    if (!comment) {
      throw new AppError('댓글을 찾을 수 없습니다.', 404)
    }

    // Hard delete (cascade will delete replies too)
    await prisma.comment.delete({ where: { id } })

    res.json({
      data: {
        success: true,
        message: '댓글이 완전히 삭제되었습니다.',
      },
    })
  } catch (error) {
    next(error)
  }
}
