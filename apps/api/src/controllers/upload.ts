import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { uploadToOCI, isOCIConfigured } from '../services/oci.js'
import { prisma } from '../services/prisma.js'
import {
  optimizeImage,
  getOptimizedFilename,
  getOptimizedMimetype,
  type OptimizeOptions,
} from '../services/imageOptimizer.js'

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
    fileSize: 20 * 1024 * 1024, // 20MB max
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

    const uniqueSuffix = crypto.randomBytes(8).toString('hex')
    const uploadType = req.query.type as string | undefined
    const folder = uploadType === 'avatar' ? 'avatars' : 'posts'

    // Determine optimization type
    let optimizeType: OptimizeOptions['type'] = 'post'
    if (uploadType === 'avatar') {
      optimizeType = 'avatar'
    } else if (uploadType === 'cover') {
      optimizeType = 'cover'
    }

    // Get buffer (from memory storage or read from disk)
    let buffer: Buffer
    if (req.file.buffer) {
      buffer = req.file.buffer
    } else if (req.file.path) {
      buffer = fs.readFileSync(req.file.path)
    } else {
      throw new AppError('파일 데이터를 읽을 수 없습니다.', 400)
    }

    // Optimize image
    const optimized = await optimizeImage(buffer, req.file.mimetype, { type: optimizeType })

    // Generate filename with optimized extension
    const baseFileName = `${Date.now()}-${uniqueSuffix}`
    const optimizedFilename = getOptimizedFilename(`${baseFileName}.tmp`, optimized.format)
    const optimizedMimetype = getOptimizedMimetype(optimized.format)

    let imageUrl: string
    let objectName: string

    if (isOCIConfigured()) {
      // Upload optimized image to OCI Object Storage
      objectName = `${folder}/${optimizedFilename}`
      imageUrl = await uploadToOCI(optimizedFilename, optimized.buffer, optimizedMimetype, folder)
    } else {
      // Fallback to local storage
      const baseUrl = process.env.API_BASE_URL || ''
      objectName = `local/${folder}/${optimizedFilename}`
      const filePath = path.join(uploadDir, optimizedFilename)
      fs.writeFileSync(filePath, optimized.buffer)
      imageUrl = `${baseUrl}/uploads/${optimizedFilename}`

      // Clean up original file if it was saved to disk
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
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
          size: optimized.size,
          mimetype: optimizedMimetype,
          folder,
        },
      })
      imageId = image.id
    }

    // Calculate compression ratio for logging
    const originalSize = req.file.size
    const optimizedSize = optimized.size
    const savings = originalSize - optimizedSize
    const savingsPercent = ((savings / originalSize) * 100).toFixed(1)

    console.log(
      `Image optimized: ${req.file.originalname} (${optimizeType}) - ` +
        `${(originalSize / 1024).toFixed(1)}KB → ${(optimizedSize / 1024).toFixed(1)}KB ` +
        `(${savingsPercent}% saved, ${optimized.width}x${optimized.height})`
    )

    res.json({
      data: {
        id: imageId,
        url: imageUrl,
        filename: optimizedFilename,
        originalName: req.file.originalname,
        size: optimized.size,
        originalSize: req.file.size,
        mimetype: optimizedMimetype,
        width: optimized.width,
        height: optimized.height,
        format: optimized.format,
      },
    })
  } catch (error) {
    next(error)
  }
}
