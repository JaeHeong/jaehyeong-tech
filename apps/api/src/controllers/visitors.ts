import type { Request, Response } from 'express'
import { prisma } from '../services/prisma.js'
import crypto from 'crypto'

// Hash IP address for privacy
function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 32)
}

// Get client IP from request
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown'
  }
  return req.ip || 'unknown'
}

// Track a visitor (called on page load)
export async function trackVisitor(req: Request, res: Response) {
  try {
    const clientIp = getClientIp(req)
    const ipHash = hashIp(clientIp)

    // Get today's date (UTC) without time
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    // Try to create a new visitor record (will fail silently if already exists for today)
    try {
      await prisma.siteVisitor.create({
        data: {
          ipHash,
          date: today,
        },
      })
    } catch {
      // Unique constraint violation - visitor already tracked today, ignore
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Track visitor error:', error)
    res.json({ success: false })
  }
}

// Get visitor statistics
export async function getVisitorStats(_req: Request, res: Response) {
  try {
    // Get today and yesterday dates (UTC)
    const now = new Date()
    const today = new Date(now)
    today.setUTCHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)

    // Count visitors for today, yesterday, and total
    const [todayCount, yesterdayCount, totalCount] = await Promise.all([
      prisma.siteVisitor.count({
        where: {
          date: today,
        },
      }),
      prisma.siteVisitor.count({
        where: {
          date: yesterday,
        },
      }),
      prisma.siteVisitor.count(),
    ])

    res.json({
      total: totalCount,
      today: todayCount,
      yesterday: yesterdayCount,
    })
  } catch (error) {
    console.error('Get visitor stats error:', error)
    res.json({
      total: 0,
      today: 0,
      yesterday: 0,
    })
  }
}
