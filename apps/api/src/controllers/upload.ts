import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { uploadToOCI, isOCIConfigured } from '../services/oci.js'
import { prisma } from '../services/prisma.js'

// Ensure upload directory exists (fallback for local storage)
const uploadDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Use memory storage for OCI upload, disk storage as fallback
const storage = isOCIConfigured()
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, uploadDir)
      },
      filename: (_req, file, cb) => {
        const uniqueSuffix = crypto.randomBytes(8).toString('hex')
        const ext = path.extname(file.originalname)
        cb(null, `${Date.now()}-${uniqueSuffix}${ext}`)
      },
    })

// File filter for images only
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('이미지 파일만 업로드 가능합니다. (JPEG, PNG, GIF, WebP, SVG)'))
  }
}

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
})

// Upload handler
export async function uploadImage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403)
    }

    if (!req.file) {
      throw new AppError('파일이 업로드되지 않았습니다.', 400)
    }

    let imageUrl: string
    const uniqueSuffix = crypto.randomBytes(8).toString('hex')
    const ext = path.extname(req.file.originalname)
    const fileName = `${Date.now()}-${uniqueSuffix}${ext}`

    const folder = req.query.type === 'avatar' ? 'avatars' : 'posts'
    let objectName: string

    if (isOCIConfigured() && req.file.buffer) {
      // Upload to OCI Object Storage
      objectName = `${folder}/${fileName}`
      imageUrl = await uploadToOCI(fileName, req.file.buffer, req.file.mimetype, folder)
    } else {
      // Fallback to local storage
      const baseUrl = process.env.API_BASE_URL || ''
      objectName = `local/${folder}/${fileName}`
      imageUrl = `${baseUrl}/uploads/${req.file.filename || fileName}`

      // If using memory storage but OCI not configured, save to disk
      if (req.file.buffer && !req.file.filename) {
        const filePath = path.join(uploadDir, fileName)
        fs.writeFileSync(filePath, req.file.buffer)
        imageUrl = `${baseUrl}/uploads/${fileName}`
      }
    }

    // Save image metadata to database (only for posts, not avatars)
    let imageId: string | null = null
    if (folder === 'posts') {
      const image = await prisma.image.create({
        data: {
          url: imageUrl,
          objectName,
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          folder,
        },
      })
      imageId = image.id
    }

    res.json({
      data: {
        id: imageId,
        url: imageUrl,
        filename: fileName,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    })
  } catch (error) {
    next(error)
  }
}
