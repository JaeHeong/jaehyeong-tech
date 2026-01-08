import { z } from 'zod'

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요.'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다.'),
})

export const registerSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요.'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다.'),
  name: z.string().min(2, '이름은 최소 2자 이상이어야 합니다.').max(50, '이름은 50자를 초과할 수 없습니다.'),
})

export const googleAuthSchema = z.object({
  credential: z.string().min(1, 'Google 인증 정보가 필요합니다.'),
})

// datetime-local format: YYYY-MM-DDTHH:mm (without seconds/timezone)
const datetimeLocalSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Invalid datetime')
  .nullable()
  .optional()
  .or(z.literal(''))

// Post schemas
export const createPostSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.').max(200, '제목은 200자를 초과할 수 없습니다.'),
  excerpt: z.string().min(1, '요약을 입력해주세요.').max(500, '요약은 500자를 초과할 수 없습니다.'),
  content: z.string().min(1, '내용을 입력해주세요.'),
  coverImage: z.string().url('유효한 URL을 입력해주세요.').nullable().optional().or(z.literal('')),
  categoryId: z.string().cuid('유효한 카테고리 ID가 아닙니다.'),
  tagIds: z.array(z.string().cuid('유효한 태그 ID가 아닙니다.')).optional(),
  status: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  featured: z.boolean().optional(),
  publishedAt: datetimeLocalSchema,
})

export const updatePostSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.').max(200, '제목은 200자를 초과할 수 없습니다.').optional(),
  excerpt: z.string().min(1, '요약을 입력해주세요.').max(500, '요약은 500자를 초과할 수 없습니다.').optional(),
  content: z.string().min(1, '내용을 입력해주세요.').optional(),
  coverImage: z.string().url('유효한 URL을 입력해주세요.').nullable().optional().or(z.literal('')),
  categoryId: z.string().cuid('유효한 카테고리 ID가 아닙니다.').optional(),
  tagIds: z.array(z.string().cuid('유효한 태그 ID가 아닙니다.')).optional(),
  status: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  featured: z.boolean().optional(),
  publishedAt: datetimeLocalSchema,
})

// Category schemas
export const createCategorySchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.').max(50, '이름은 50자를 초과할 수 없습니다.'),
  slug: z.string().min(1, 'Slug를 입력해주세요.').max(50, 'Slug는 50자를 초과할 수 없습니다.')
    .regex(/^[a-z0-9-]+$/, 'Slug는 소문자, 숫자, 하이픈만 사용할 수 있습니다.'),
  description: z.string().max(200, '설명은 200자를 초과할 수 없습니다.').nullable().optional(),
  icon: z.string().max(50, '아이콘은 50자를 초과할 수 없습니다.').nullable().optional(),
  color: z.string().max(20, '색상은 20자를 초과할 수 없습니다.').nullable().optional(),
})

export const updateCategorySchema = createCategorySchema.partial()

// Tag schemas
export const createTagSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.').max(30, '이름은 30자를 초과할 수 없습니다.'),
  slug: z.string().min(1, 'Slug를 입력해주세요.').max(30, 'Slug는 30자를 초과할 수 없습니다.')
    .regex(/^[a-z0-9-]+$/, 'Slug는 소문자, 숫자, 하이픈만 사용할 수 있습니다.'),
})

export const updateTagSchema = createTagSchema.partial()

// Page schemas
export const createPageSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.').max(200, '제목은 200자를 초과할 수 없습니다.'),
  slug: z.string().max(100, 'Slug는 100자를 초과할 수 없습니다.')
    .regex(/^[a-z0-9-]+$/, 'Slug는 소문자, 숫자, 하이픈만 사용할 수 있습니다.').optional(),
  type: z.enum(['STATIC', 'NOTICE']).optional(),
  content: z.string().min(1, '내용을 입력해주세요.'),
  excerpt: z.string().max(500, '요약은 500자를 초과할 수 없습니다.').nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  badge: z.string().max(20, '뱃지는 20자를 초과할 수 없습니다.').nullable().optional(),
  badgeColor: z.string().max(20, '뱃지 색상은 20자를 초과할 수 없습니다.').nullable().optional(),
  isPinned: z.boolean().optional(),
  template: z.string().max(50, '템플릿은 50자를 초과할 수 없습니다.').nullable().optional(),
})

export const updatePageSchema = createPageSchema.partial()

// Author profile schema
export const updateAuthorSchema = z.object({
  name: z.string().min(2, '이름은 최소 2자 이상이어야 합니다.').max(50, '이름은 50자를 초과할 수 없습니다.').optional(),
  bio: z.string().max(500, '소개는 500자를 초과할 수 없습니다.').nullable().optional(),
  title: z.string().max(100, '직함은 100자를 초과할 수 없습니다.').nullable().optional(),
  avatar: z.string().url('유효한 URL을 입력해주세요.').nullable().optional().or(z.literal('')),
  github: z.string().url('유효한 URL을 입력해주세요.').nullable().optional().or(z.literal('')),
  twitter: z.string().url('유효한 URL을 입력해주세요.').nullable().optional().or(z.literal('')),
  linkedin: z.string().url('유효한 URL을 입력해주세요.').nullable().optional().or(z.literal('')),
  website: z.string().url('유효한 URL을 입력해주세요.').nullable().optional().or(z.literal('')),
})

// Query param schemas
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
})

export const postQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().max(100, '검색어는 100자를 초과할 수 없습니다.').optional(),
  status: z.enum(['PUBLIC', 'PUBLISHED', 'PRIVATE', 'ALL']).optional(),
  sortBy: z.enum(['publishedAt', 'updatedAt', 'viewCount', 'likeCount']).optional(),
})

// ID parameter schema
export const idParamSchema = z.object({
  id: z.string().cuid('유효한 ID가 아닙니다.'),
})

// Bulk delete schema
export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().cuid('유효한 ID가 아닙니다.')).min(1, '삭제할 항목을 선택해주세요.'),
})

export const slugParamSchema = z.object({
  slug: z.string().min(1, 'Slug가 필요합니다.'),
})

// Comment schemas
export const createCommentSchema = z.object({
  content: z.string().min(1, '댓글 내용을 입력해주세요.').max(2000, '댓글은 2000자를 초과할 수 없습니다.'),
  guestName: z.string().min(1, '이름을 입력해주세요.').max(50, '이름은 50자를 초과할 수 없습니다.').optional(),
  guestPassword: z.string().min(4, '비밀번호는 4자 이상이어야 합니다.').max(100).optional(),
  parentId: z.string().cuid('유효한 댓글 ID가 아닙니다.').optional(),
  isPrivate: z.boolean().optional(),
})

export const updateCommentSchema = z.object({
  content: z.string().min(1, '댓글 내용을 입력해주세요.').max(2000, '댓글은 2000자를 초과할 수 없습니다.'),
  guestPassword: z.string().min(4, '비밀번호는 4자 이상이어야 합니다.').optional(),
  isPrivate: z.boolean().optional(),
})

// Type exports
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type CreatePostInput = z.infer<typeof createPostSchema>
export type UpdatePostInput = z.infer<typeof updatePostSchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type CreateTagInput = z.infer<typeof createTagSchema>
export type CreatePageInput = z.infer<typeof createPageSchema>
export type UpdateAuthorInput = z.infer<typeof updateAuthorSchema>
export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>
