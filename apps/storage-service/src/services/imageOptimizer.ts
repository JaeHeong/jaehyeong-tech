import sharp from 'sharp'

export interface OptimizedImage {
  buffer: Buffer
  width: number
  height: number
  size: number
  format: 'webp' | 'png' | 'jpeg' | 'gif' | 'svg'
  originalFormat: string
}

export interface OptimizeOptions {
  type: 'avatar' | 'cover' | 'post'
  quality?: number
}

// Image dimension presets
const PRESETS = {
  avatar: {
    width: 256,
    height: 256,
    fit: 'cover' as const,
  },
  cover: {
    width: 1200,
    height: 630,
    fit: 'cover' as const,
  },
  post: {
    width: 1600,
    height: null, // Maintain aspect ratio
    fit: 'inside' as const,
  },
}

// Default quality for WebP compression
const DEFAULT_QUALITY = 85

/**
 * Check if the image format should be optimized
 * SVG and GIF are excluded (vector/animation)
 */
function shouldOptimize(mimetype: string): boolean {
  // Skip SVG (vector) and GIF (animation)
  return !['image/svg+xml', 'image/gif'].includes(mimetype)
}

/**
 * Get the original format from mimetype
 */
function getFormatFromMimetype(mimetype: string): string {
  const formatMap: Record<string, string> = {
    'image/jpeg': 'jpeg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  }
  return formatMap[mimetype] || 'jpeg'
}

/**
 * Optimize an image based on its intended use
 */
export async function optimizeImage(
  buffer: Buffer,
  mimetype: string,
  options: OptimizeOptions
): Promise<OptimizedImage> {
  const originalFormat = getFormatFromMimetype(mimetype)

  // Skip optimization for SVG and GIF
  if (!shouldOptimize(mimetype)) {
    return {
      buffer,
      width: 0,
      height: 0,
      size: buffer.length,
      format: originalFormat as OptimizedImage['format'],
      originalFormat,
    }
  }

  const preset = PRESETS[options.type]
  const quality = options.quality || DEFAULT_QUALITY

  let pipeline = sharp(buffer)

  // Get original metadata
  const metadata = await pipeline.metadata()

  // Apply resize based on preset
  if (options.type === 'post') {
    // For post images, only resize if larger than max width
    if (metadata.width && metadata.width > preset.width) {
      pipeline = pipeline.resize({
        width: preset.width,
        height: undefined,
        fit: 'inside',
        withoutEnlargement: true,
      })
    }
  } else {
    // For avatar and cover, resize to exact dimensions
    pipeline = pipeline.resize({
      width: preset.width,
      height: preset.height!,
      fit: preset.fit,
      position: 'center',
    })
  }

  // Convert to WebP for better compression
  pipeline = pipeline.webp({ quality })

  // Process the image
  const optimizedBuffer = await pipeline.toBuffer()
  const optimizedMetadata = await sharp(optimizedBuffer).metadata()

  return {
    buffer: optimizedBuffer,
    width: optimizedMetadata.width || 0,
    height: optimizedMetadata.height || 0,
    size: optimizedBuffer.length,
    format: 'webp',
    originalFormat,
  }
}

/**
 * Get the new filename with WebP extension
 */
export function getOptimizedFilename(originalFilename: string, format: string): string {
  if (format === 'svg' || format === 'gif') {
    return originalFilename
  }

  // Replace extension with .webp
  const baseName = originalFilename.replace(/\.[^/.]+$/, '')
  return `${baseName}.webp`
}

/**
 * Get the new mimetype for optimized image
 */
export function getOptimizedMimetype(format: OptimizedImage['format']): string {
  const mimetypeMap: Record<string, string> = {
    webp: 'image/webp',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  }
  return mimetypeMap[format] || 'image/webp'
}
