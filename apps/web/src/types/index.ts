export interface Post {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  coverImage?: string
  category: Category
  tags: Tag[]
  author: Author
  viewCount: number
  likeCount: number
  readingTime: number
  createdAt: string
  updatedAt: string
  publishedAt?: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  color?: string
  postCount: number
}

export interface Tag {
  id: string
  name: string
  slug: string
  postCount: number
}

export interface Author {
  id: string
  name: string
  email: string
  avatar?: string
  bio?: string
  role?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface ApiError {
  message: string
  statusCode: number
  error?: string
}
