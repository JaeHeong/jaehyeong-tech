import type { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { prisma } from '../services/prisma.js'
import { AppError } from '../middleware/errorHandler.js'

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

    if (!postId) {
      throw new AppError('게시글 ID가 필요합니다.', 400)
    }

    // Find the post
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, published: true },
    })

    if (!post) {
      throw new AppError('게시글을 찾을 수 없습니다.', 404)
    }

    if (!post.published) {
      throw new AppError('비공개 게시글입니다.', 403)
    }

    const ipHash = hashIP(getClientIP(req))

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: {
        postId_ipHash: {
          postId,
          ipHash,
        },
      },
    })

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
        prisma.like.create({
          data: {
            post: { connect: { id: postId } },
            ipHash,
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

    const ipHash = hashIP(getClientIP(req))

    const existingLike = await prisma.like.findUnique({
      where: {
        postId_ipHash: {
          postId,
          ipHash,
        },
      },
    })

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
