import type { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../services/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import type { AuthRequest } from '../middleware/auth.js'
import { deleteFromOCI, isOCIConfigured } from '../services/oci.js'

// Admin email whitelist - only these emails get ADMIN role
// Read from environment variable (comma-separated list)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim())
  .filter(email => email.length > 0)

// Extract object name from OCI URL for deletion
function extractOCIObjectName(url: string): string | null {
  // OCI URL format: https://objectstorage.{region}.oraclecloud.com/n/{namespace}/b/{bucket}/o/{objectName}
  const match = url.match(/\/o\/(.+)$/)
  if (match && match[1]) {
    return decodeURIComponent(match[1])
  }
  return null
}

function generateToken(userId: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new AppError('서버 설정 오류', 500)
  }
  return jwt.sign({ userId }, secret, { expiresIn: '7d' })
}

interface GoogleTokenPayload {
  sub: string
  email: string
  email_verified: boolean
  name: string
  picture?: string
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      throw new AppError('이메일과 비밀번호를 입력해주세요.', 400)
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.password) {
      throw new AppError('이메일 또는 비밀번호가 일치하지 않습니다.', 401)
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      throw new AppError('이메일 또는 비밀번호가 일치하지 않습니다.', 401)
    }

    const token = generateToken(user.id)

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          status: user.status,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name } = req.body

    if (!email || !password || !name) {
      throw new AppError('모든 필드를 입력해주세요.', 400)
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new AppError('이미 사용 중인 이메일입니다.', 400)
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    // Check if this is the first user (make them admin)
    const userCount = await prisma.user.count()
    const role = userCount === 0 ? 'ADMIN' : 'USER'

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
      },
    })

    const token = generateToken(user.id)

    res.status(201).json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401)
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        title: true,
        github: true,
        twitter: true,
        linkedin: true,
        website: true,
        role: true,
        status: true,
        createdAt: true,
      },
    })

    if (!user) {
      throw new AppError('사용자를 찾을 수 없습니다.', 404)
    }

    res.json({ data: user })
  } catch (error) {
    next(error)
  }
}

export async function updateMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('인증이 필요합니다.', 401)
    }

    const { name, avatar, bio, title, github, twitter, linkedin, website, currentPassword, newPassword } = req.body

    // Get current user data to check for avatar changes
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { avatar: true, password: true }
    })
    if (!currentUser) {
      throw new AppError('사용자를 찾을 수 없습니다.', 404)
    }

    const updateData: Record<string, unknown> = {}
    if (name) updateData.name = name
    if (avatar !== undefined) updateData.avatar = avatar || null
    if (bio !== undefined) updateData.bio = bio
    if (title !== undefined) updateData.title = title
    if (github !== undefined) updateData.github = github
    if (twitter !== undefined) updateData.twitter = twitter
    if (linkedin !== undefined) updateData.linkedin = linkedin
    if (website !== undefined) updateData.website = website

    // Delete old avatar from OCI if avatar is being changed or removed
    if (avatar !== undefined && currentUser.avatar && currentUser.avatar !== avatar) {
      // Only delete if it's an OCI URL (avatars folder)
      // Check both encoded (%2F) and decoded (/) versions
      const isAvatarUrl = currentUser.avatar.includes('oraclecloud.com') &&
        (currentUser.avatar.includes('/avatars/') || currentUser.avatar.includes('avatars%2F'))
      if (isAvatarUrl) {
        const objectName = extractOCIObjectName(currentUser.avatar)
        if (objectName && isOCIConfigured()) {
          try {
            await deleteFromOCI(objectName)
            console.log(`Deleted old avatar from OCI: ${objectName}`)
          } catch (err) {
            // Log but don't fail the request if deletion fails
            console.error('Failed to delete old avatar from OCI:', err)
          }
        }
      }
    }

    // Password change
    if (newPassword) {
      if (!currentPassword) {
        throw new AppError('현재 비밀번호를 입력해주세요.', 400)
      }

      // OAuth users don't have password - they can set a new one directly
      if (currentUser.password) {
        const isValid = await bcrypt.compare(currentPassword, currentUser.password)
        if (!isValid) {
          throw new AppError('현재 비밀번호가 일치하지 않습니다.', 400)
        }
      }

      updateData.password = await bcrypt.hash(newPassword, 12)
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        title: true,
        github: true,
        twitter: true,
        linkedin: true,
        website: true,
        role: true,
      },
    })

    res.json({ data: user })
  } catch (error) {
    next(error)
  }
}

// Google OAuth login
export async function googleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { credential } = req.body

    if (!credential) {
      throw new AppError('Google 인증 정보가 필요합니다.', 400)
    }

    // Verify Google ID token
    const googleClientId = process.env.GOOGLE_CLIENT_ID
    if (!googleClientId) {
      throw new AppError('서버 설정 오류: Google Client ID가 설정되지 않았습니다.', 500)
    }

    // Decode and verify the JWT token from Google
    // The token is a JWT signed by Google
    const tokenParts = credential.split('.')
    if (tokenParts.length !== 3) {
      throw new AppError('유효하지 않은 Google 토큰입니다.', 400)
    }

    // Decode payload (base64url)
    const payloadBase64 = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8')
    const payload: GoogleTokenPayload = JSON.parse(payloadJson)

    // Verify token audience and expiration
    const tokenPayload = JSON.parse(payloadJson) as { aud: string; exp: number; iss: string }

    if (tokenPayload.aud !== googleClientId) {
      throw new AppError('유효하지 않은 Google 토큰입니다.', 400)
    }

    if (tokenPayload.exp * 1000 < Date.now()) {
      throw new AppError('만료된 Google 토큰입니다.', 400)
    }

    if (!['accounts.google.com', 'https://accounts.google.com'].includes(tokenPayload.iss)) {
      throw new AppError('유효하지 않은 Google 토큰입니다.', 400)
    }

    if (!payload.email_verified) {
      throw new AppError('인증되지 않은 이메일입니다.', 400)
    }

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: payload.email },
    })

    if (!user) {
      // Create new user with Google OAuth
      const role = ADMIN_EMAILS.includes(payload.email) ? 'ADMIN' : 'USER'

      user = await prisma.user.create({
        data: {
          email: payload.email,
          googleId: payload.sub,
          name: payload.name,
          avatar: payload.picture,
          role,
        },
      })
    } else if (!user.googleId) {
      // Link existing user to Google account
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: payload.sub,
          avatar: user.avatar || payload.picture,
        },
      })
    }

    // Update role if email is in admin whitelist
    if (ADMIN_EMAILS.includes(payload.email) && user.role !== 'ADMIN') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      })
    }

    const token = generateToken(user.id)

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          status: user.status,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}
