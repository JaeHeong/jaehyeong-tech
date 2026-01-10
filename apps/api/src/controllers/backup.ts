import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import { prisma } from '../services/prisma.js'
import {
  uploadToBackupBucket,
  downloadFromBackupBucket,
  listBackupObjects,
  deleteFromBackupBucket,
  isOCIConfigured,
} from '../services/oci.js'

const BACKUP_FOLDER = 'backups'

interface PostWithTags {
  id: string
  tags: { id: string }[]
  [key: string]: unknown
}

interface BackupData {
  version: string
  description?: string
  createdAt: string
  data: {
    users: unknown[]
    categories: unknown[]
    tags: unknown[]
    posts: unknown[]
    drafts: unknown[]
    pages: unknown[]
    comments: unknown[]
    bookmarks?: unknown[]
    likes?: unknown[]
    images?: unknown[]
    bugReports?: unknown[]
    siteVisitors?: unknown[]
  }
}

// Create backup
export async function createBackup(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    if (!isOCIConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500)
    }

    // Fetch all data
    const [users, categories, tags, posts, drafts, pages, comments, bookmarks, likes, images, bugReports] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          googleId: true,
          name: true,
          role: true,
          status: true,
          avatar: true,
          bio: true,
          title: true,
          github: true,
          twitter: true,
          linkedin: true,
          website: true,
          createdAt: true,
        },
      }),
      prisma.category.findMany(),
      prisma.tag.findMany(),
      prisma.post.findMany({
        include: {
          tags: { select: { id: true } },
        },
      }),
      prisma.draft.findMany(),
      prisma.page.findMany(),
      prisma.comment.findMany({
        select: {
          id: true,
          content: true,
          guestName: true,
          guestPassword: true,
          isPrivate: true,
          isDeleted: true,
          postId: true,
          authorId: true,
          parentId: true,
          ipHash: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      // Bookmarks (user bookmarks)
      prisma.bookmark.findMany({
        select: {
          id: true,
          postId: true,
          userId: true,
          createdAt: true,
        },
      }),
      // Likes (only logged-in user likes, not anonymous IP-based likes)
      prisma.like.findMany({
        where: {
          userId: { not: null },
        },
        select: {
          id: true,
          postId: true,
          userId: true,
          createdAt: true,
        },
      }),
      // Images (metadata for orphan cleanup)
      prisma.image.findMany({
        select: {
          id: true,
          url: true,
          objectName: true,
          filename: true,
          size: true,
          mimetype: true,
          folder: true,
          postId: true,
          createdAt: true,
        },
      }),
      // Bug reports
      prisma.bugReport.findMany(),
    ])

    // Fetch site visitors separately (table might not exist in older DBs)
    let siteVisitors: unknown[] = []
    try {
      siteVisitors = await prisma.siteVisitor.findMany()
    } catch {
      // Table doesn't exist, skip
    }

    const { description } = req.body as { description?: string }

    const backupData: BackupData = {
      version: '1.6',
      description: description || undefined,
      createdAt: new Date().toISOString(),
      data: {
        users,
        categories,
        tags,
        posts: posts.map((post: PostWithTags) => ({
          ...post,
          tagIds: post.tags.map((t: { id: string }) => t.id),
          tags: undefined,
        })),
        drafts,
        pages,
        comments,
        bookmarks,
        likes,
        images,
        bugReports,
        siteVisitors,
      },
    }

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `backup_${timestamp}.json`

    // Upload to backup bucket
    const buffer = Buffer.from(JSON.stringify(backupData, null, 2), 'utf-8')
    const objectPath = await uploadToBackupBucket(fileName, buffer, 'application/json', BACKUP_FOLDER)

    res.json({
      data: {
        success: true,
        fileName,
        objectPath,
        createdAt: backupData.createdAt,
        stats: {
          users: users.length,
          categories: categories.length,
          tags: tags.length,
          posts: posts.length,
          drafts: drafts.length,
          pages: pages.length,
          comments: comments.length,
          bookmarks: bookmarks.length,
          likes: likes.length,
          images: images.length,
          bugReports: bugReports.length,
          siteVisitors: siteVisitors.length,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

// List backups
export async function listBackups(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    if (!isOCIConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500)
    }

    const objects = await listBackupObjects(BACKUP_FOLDER)
    const backupFiles = objects.filter((name) => name.endsWith('.json'))

    // Fetch description for each backup file
    const backups = await Promise.all(
      backupFiles.map(async (name) => {
        // Extract timestamp from filename: backup_2024-01-15T10-30-00-000Z.json
        // Original format was: 2024-01-15T10:30:00.000Z (colons and dots replaced with hyphens)
        const match = name.match(/backup_(.+)\.json$/)
        let createdAt: string | null = null
        let description: string | null = null

        if (match && match[1]) {
          try {
            // Convert: 2024-01-15T10-30-00-000Z → 2024-01-15T10:30:00.000Z
            const ts = match[1]
            // Format: YYYY-MM-DDTHH-MM-SS-mmmZ
            const parsed = ts.replace(
              /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
              '$1T$2:$3:$4.$5Z'
            )
            const date = new Date(parsed)
            if (!isNaN(date.getTime())) {
              createdAt = date.toISOString()
            }
          } catch {
            // Ignore parsing errors
          }
        }

        // Try to read description from backup file
        try {
          const buffer = await downloadFromBackupBucket(name)
          const backupData: BackupData = JSON.parse(buffer.toString('utf-8'))
          description = backupData.description || null
        } catch {
          // Ignore errors reading backup file
        }

        return {
          name: name.split('/').pop(),
          fullPath: name,
          createdAt,
          description,
        }
      })
    )

    const sortedBackups = backups.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

    res.json({ data: sortedBackups })
  } catch (error) {
    next(error)
  }
}

// Get backup info (preview)
export async function getBackupInfo(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    if (!isOCIConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500)
    }

    const { fileName } = req.params
    if (!fileName) {
      throw new AppError('파일명이 필요합니다.', 400)
    }

    const objectName = `${BACKUP_FOLDER}/${fileName}`
    const buffer = await downloadFromBackupBucket(objectName)
    const backupData: BackupData = JSON.parse(buffer.toString('utf-8'))

    res.json({
      data: {
        fileName,
        version: backupData.version,
        description: backupData.description || null,
        createdAt: backupData.createdAt,
        stats: {
          users: backupData.data.users?.length || 0,
          categories: backupData.data.categories?.length || 0,
          tags: backupData.data.tags?.length || 0,
          posts: backupData.data.posts?.length || 0,
          drafts: backupData.data.drafts?.length || 0,
          pages: backupData.data.pages?.length || 0,
          comments: backupData.data.comments?.length || 0,
          bookmarks: backupData.data.bookmarks?.length || 0,
          likes: backupData.data.likes?.length || 0,
          images: backupData.data.images?.length || 0,
          bugReports: backupData.data.bugReports?.length || 0,
          siteVisitors: backupData.data.siteVisitors?.length || 0,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

// Download backup
export async function downloadBackup(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    if (!isOCIConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500)
    }

    const { fileName } = req.params
    if (!fileName) {
      throw new AppError('파일명이 필요합니다.', 400)
    }

    const objectName = `${BACKUP_FOLDER}/${fileName}`
    const buffer = await downloadFromBackupBucket(objectName)

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

// Restore from backup
export async function restoreBackup(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    if (!isOCIConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500)
    }

    const { fileName } = req.params
    if (!fileName) {
      throw new AppError('파일명이 필요합니다.', 400)
    }

    const objectName = `${BACKUP_FOLDER}/${fileName}`
    const buffer = await downloadFromBackupBucket(objectName)
    const backupData: BackupData = JSON.parse(buffer.toString('utf-8'))

    if (!backupData.version || !backupData.data) {
      throw new AppError('유효하지 않은 백업 파일입니다.', 400)
    }

    // Get current admin user info
    const currentAdmin = await prisma.user.findUnique({
      where: { id: req.user.id }
    })
    if (!currentAdmin) {
      throw new AppError('현재 관리자 정보를 찾을 수 없습니다.', 400)
    }

    // Restore data in transaction
    await prisma.$transaction(async (tx) => {
      // Clear existing data
      // Delete in order respecting foreign key constraints
      await tx.bookmark.deleteMany({})
      await tx.like.deleteMany({})
      await tx.postView.deleteMany({})  // Must delete before posts
      await tx.pageView.deleteMany({})  // Must delete before pages
      await tx.comment.deleteMany({})
      await tx.image.deleteMany({})
      await tx.post.deleteMany({})
      await tx.draft.deleteMany({})
      await tx.page.deleteMany({})
      await tx.tag.deleteMany({})
      await tx.category.deleteMany({})
      await tx.bugReport.deleteMany({})

      // Handle siteVisitor deletion gracefully (table might not exist in older DBs)
      try {
        await tx.siteVisitor.deleteMany({})
      } catch {
        // Table doesn't exist, skip
      }

      // Delete all users
      await tx.user.deleteMany({})

      // Restore users with ID mapping
      // If the current admin's email matches a backup admin, we need to preserve the backup's user IDs
      // so that all foreign key references (authorId) remain valid
      if (backupData.data.users?.length) {
        for (const user of backupData.data.users) {
          const userData = user as {
            id: string
            email: string
            googleId?: string | null
            name: string
            role: 'USER' | 'ADMIN'
            status?: 'ACTIVE' | 'SUSPENDED'
            avatar?: string | null
            bio?: string | null
            title?: string | null
            github?: string | null
            twitter?: string | null
            linkedin?: string | null
            website?: string | null
            createdAt: Date | string
          }

          // For the current admin's email, use current googleId to maintain login
          const isCurrentAdminEmail = userData.email === currentAdmin.email

          await tx.user.create({
            data: {
              id: userData.id, // Use backup's ID to preserve foreign key references
              email: userData.email,
              googleId: isCurrentAdminEmail ? currentAdmin.googleId : userData.googleId,
              name: userData.name,
              role: userData.role,
              status: userData.status || 'ACTIVE',
              avatar: userData.avatar,
              bio: userData.bio,
              title: userData.title,
              github: userData.github,
              twitter: userData.twitter,
              linkedin: userData.linkedin,
              website: userData.website,
              createdAt: new Date(userData.createdAt),
            }
          })
        }
      }

      // Restore categories
      if (backupData.data.categories?.length) {
        for (const category of backupData.data.categories) {
          await tx.category.create({ data: category as never })
        }
      }

      // Restore tags
      if (backupData.data.tags?.length) {
        for (const tag of backupData.data.tags) {
          await tx.tag.create({ data: tag as never })
        }
      }

      // Restore pages
      if (backupData.data.pages?.length) {
        for (const page of backupData.data.pages) {
          await tx.page.create({ data: page as never })
        }
      }

      // Restore posts with tag connections
      if (backupData.data.posts?.length) {
        for (const post of backupData.data.posts) {
          const { tagIds, ...postData } = post as { tagIds?: string[] } & Record<string, unknown>
          await tx.post.create({
            data: {
              ...postData,
              tags: tagIds?.length ? { connect: tagIds.map((id) => ({ id })) } : undefined,
            } as never,
          })
        }
      }

      // Restore drafts
      if (backupData.data.drafts?.length) {
        for (const draft of backupData.data.drafts) {
          await tx.draft.create({ data: draft as never })
        }
      }

      // Restore comments (parent comments first, then replies)
      if (backupData.data.comments?.length) {
        const comments = backupData.data.comments as Array<{ parentId?: string | null } & Record<string, unknown>>
        // First, create parent comments (no parentId)
        const parentComments = comments.filter(c => !c.parentId)
        const replyComments = comments.filter(c => c.parentId)

        for (const comment of parentComments) {
          await tx.comment.create({ data: comment as never })
        }
        // Then, create reply comments
        for (const comment of replyComments) {
          await tx.comment.create({ data: comment as never })
        }
      }

      // Restore bookmarks (v1.3+)
      if (backupData.data.bookmarks?.length) {
        for (const bookmark of backupData.data.bookmarks) {
          await tx.bookmark.create({ data: bookmark as never })
        }
      }

      // Restore likes (v1.3+)
      if (backupData.data.likes?.length) {
        for (const like of backupData.data.likes) {
          await tx.like.create({ data: like as never })
        }
      }

      // Restore images (v1.4+)
      if (backupData.data.images?.length) {
        for (const image of backupData.data.images) {
          await tx.image.create({ data: image as never })
        }
      }

      // Restore bug reports (v1.5+)
      if (backupData.data.bugReports?.length) {
        for (const bugReport of backupData.data.bugReports) {
          await tx.bugReport.create({ data: bugReport as never })
        }
      }

      // Restore site visitors (v1.6+)
      if (backupData.data.siteVisitors?.length) {
        try {
          for (const visitor of backupData.data.siteVisitors) {
            await tx.siteVisitor.create({ data: visitor as never })
          }
        } catch {
          // Table doesn't exist, skip
        }
      }
    })

    res.json({
      data: {
        success: true,
        message: '백업이 복원되었습니다.',
        restoredAt: new Date().toISOString(),
        stats: {
          users: backupData.data.users?.length || 0,
          categories: backupData.data.categories?.length || 0,
          tags: backupData.data.tags?.length || 0,
          posts: backupData.data.posts?.length || 0,
          drafts: backupData.data.drafts?.length || 0,
          pages: backupData.data.pages?.length || 0,
          comments: backupData.data.comments?.length || 0,
          bookmarks: backupData.data.bookmarks?.length || 0,
          likes: backupData.data.likes?.length || 0,
          images: backupData.data.images?.length || 0,
          bugReports: backupData.data.bugReports?.length || 0,
          siteVisitors: backupData.data.siteVisitors?.length || 0,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

// Delete backup
export async function deleteBackup(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    if (!isOCIConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500)
    }

    const { fileName } = req.params
    if (!fileName) {
      throw new AppError('파일명이 필요합니다.', 400)
    }

    const objectName = `${BACKUP_FOLDER}/${fileName}`
    await deleteFromBackupBucket(objectName)

    res.json({
      data: {
        success: true,
        message: '백업이 삭제되었습니다.',
      },
    })
  } catch (error) {
    next(error)
  }
}
