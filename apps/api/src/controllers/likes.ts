import type { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { prisma } from '../services/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { AuthRequest } from '../middleware/auth.js'
import { updateFeaturedPost } from './posts.js'

// Hash IP address for privacy
function hashIP(ip: string): string {
  const salt = process.env.IP_HASH_SALT || 'default-salt-change-in-production'
  return crypto.createHash('sha256').update(ip + salt).digest('hex')
}

// Get client IP (considering reverse proxy)
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

// Toggle like on a post
export async function toggleLike(req: Request, res: Response, next: NextFunction) {
  try {
    const postId = req.params.id
    const authReq = req as AuthRequest
    const userId = authReq.user?.id

    if (!postId) {
      throw new AppError('게시글 ID가 필요합니다.', 400)
    }

    // Find the post
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    })

    if (!post) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404)
    }

    if (post.status !== 'PUBLIC') {
      throw new AppError('비공개 게시글입니다.', 403)
    }

    let existingLike

    if (userId) {
      // Logged-in user: check by userId
      existingLike = await prisma.like.findFirst({
        where: {
          postId,
          userId,
        },
      })
    } else {
      // Anonymous user: check by ipHash
      const ipHash = hashIP(getClientIP(req))
      existingLike = await prisma.like.findFirst({
        where: {
          postId,
          ipHash,
        },
      })
    }

    let liked: boolean
    let likeCount: number

    if (existingLike) {
      // Unlike: delete the like and decrement counter
      await prisma.$transaction([
        prisma.like.delete({
          where: { id: existingLike.id },
        }),
        prisma.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
        }),
      ])
      liked = false
      likeCount = await prisma.like.count({ where: { postId } })
    } else {
      // Like: create like and increment counter
      await prisma.$transaction([
        userId
          ? prisma.like.create({
              data: {
                post: { connect: { id: postId } },
                user: { connect: { id: userId } },
              },
            })
          : prisma.like.create({
              data: {
                post: { connect: { id: postId } },
                ipHash: hashIP(getClientIP(req)),
              },
            }),
        prisma.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
        }),
      ])
      liked = true
      likeCount = await prisma.like.count({ where: { postId } })
    }

    // Update featured post based on new like count
    await updateFeaturedPost()

    res.json({
      data: {
        liked,
        likeCount,
      },
    })
  } catch (error) {
    next(error)
  }
}

// Check if current user has liked a post
export async function checkLikeStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const postId = req.params.id
    const authReq = req as AuthRequest
    const userId = authReq.user?.id

    if (!postId) {
      throw new AppError('게시글 ID가 필요합니다.', 400)
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, likeCount: true },
    })

    if (!post) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404)
    }

    let existingLike

    if (userId) {
      // Logged-in user: check by userId
      existingLike = await prisma.like.findFirst({
        where: {
          postId,
          userId,
        },
      })
    } else {
      // Anonymous user: check by ipHash
      const ipHash = hashIP(getClientIP(req))
      existingLike = await prisma.like.findFirst({
        where: {
          postId,
          ipHash,
        },
      })
    }

    res.json({
      data: {
        liked: !!existingLike,
        likeCount: post.likeCount,
      },
    })
  } catch (error) {
    next(error)
  }
}
