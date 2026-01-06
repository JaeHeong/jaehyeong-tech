const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: unknown
}

class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    this.token = localStorage.getItem('auth_token')
  }

  setToken(token: string | null) {
    this.token = token
    if (token) {
      localStorage.setItem('auth_token', token)
    } else {
      localStorage.removeItem('auth_token')
    }
  }

  getToken(): string | null {
    return this.token
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', headers = {}, body } = options

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    }

    if (this.token) {
      requestHeaders['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }))
      throw new Error(error.message || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.request<{ data: { token: string; user: AuthUser } }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    this.setToken(response.data.token)
    return response.data
  }

  async googleLogin(credential: string) {
    const response = await this.request<{ data: { token: string; user: AuthUser } }>('/auth/google', {
      method: 'POST',
      body: { credential },
    })
    this.setToken(response.data.token)
    return response.data
  }

  async register(name: string, email: string, password: string) {
    return this.request<{ data: { token: string; user: AuthUser } }>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    })
  }

  async getCurrentUser() {
    return this.request<{ data: AuthUser }>('/auth/me')
  }

  async updateProfile(data: UpdateProfileData) {
    return this.request<{ data: AuthUser }>('/auth/me', {
      method: 'PUT',
      body: data,
    })
  }

  logout() {
    this.setToken(null)
  }

  // Author info endpoint (public)
  async getAuthorInfo() {
    return this.request<{ data: AuthorInfo }>('/author')
  }

  // Posts endpoints
  async getPosts(params?: PostsQueryParams) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.category) searchParams.set('category', params.category)
    if (params?.tag) searchParams.set('tag', params.tag)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy)
    if (params?.featured !== undefined) searchParams.set('featured', params.featured.toString())

    const query = searchParams.toString()
    const response = await this.request<{ data: Post[]; meta: PostsResponse['meta'] }>(`/posts${query ? `?${query}` : ''}`)
    return { posts: response.data, meta: response.meta }
  }

  async getPost(slug: string) {
    return this.request<{ post: Post }>(`/posts/${slug}`)
  }

  async getFeaturedPosts() {
    return this.request<{ posts: Post[] }>('/posts/featured')
  }

  async createPost(data: CreatePostData) {
    return this.request<{ post: Post }>('/posts', {
      method: 'POST',
      body: data,
    })
  }

  async updatePost(id: string, data: UpdatePostData) {
    return this.request<{ post: Post }>(`/posts/${id}`, {
      method: 'PUT',
      body: data,
    })
  }

  async deletePost(id: string) {
    return this.request<{ success: boolean }>(`/posts/${id}`, {
      method: 'DELETE',
    })
  }

  // Categories endpoints
  async getCategories() {
    const response = await this.request<{ data: Category[] }>('/categories')
    return { categories: response.data }
  }

  async getCategory(slug: string) {
    return this.request<{ category: Category }>(`/categories/${slug}`)
  }

  async getCategoryPosts(slug: string, params?: { page?: number; limit?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const query = searchParams.toString()
    return this.request<PostsResponse>(`/categories/${slug}/posts${query ? `?${query}` : ''}`)
  }

  // Tags endpoints
  async getTags() {
    const response = await this.request<{ data: Tag[] }>('/tags')
    return { tags: response.data }
  }

  async getTagPosts(slug: string, params?: { page?: number; limit?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const query = searchParams.toString()
    return this.request<PostsResponse>(`/tags/${slug}/posts${query ? `?${query}` : ''}`)
  }

  // Search endpoint
  async search(query: string, params?: { page?: number; limit?: number }) {
    const searchParams = new URLSearchParams()
    searchParams.set('search', query)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    return this.request<PostsResponse>(`/posts?${searchParams.toString()}`)
  }

  // Admin stats
  async getAdminStats() {
    return this.request<AdminStats>('/admin/stats')
  }

  // Upload image
  async uploadImage(fileOrFormData: File | FormData): Promise<{ url: string }> {
    const formData = fileOrFormData instanceof FormData ? fileOrFormData : (() => {
      const fd = new FormData()
      fd.append('image', fileOrFormData)
      return fd
    })()

    const response = await fetch(`${this.baseUrl}/upload/image`, {
      method: 'POST',
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '업로드 실패' }))
      throw new Error(error.message || '이미지 업로드에 실패했습니다.')
    }

    const result = await response.json()
    return { url: result.data.url }
  }

  // Fetch URL metadata for link bookmarks
  async fetchUrlMetadata(url: string): Promise<UrlMetadata> {
    return this.request<UrlMetadata>('/metadata', {
      method: 'POST',
      body: { url },
    })
  }

  // Pages endpoints
  async getPages(params?: PagesQueryParams) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.type) searchParams.set('type', params.type)

    const query = searchParams.toString()
    const response = await this.request<{ data: Page[]; meta: PagesResponse['meta'] }>(`/pages${query ? `?${query}` : ''}`)
    return { pages: response.data, meta: response.meta }
  }

  async getNotices(params?: { page?: number; limit?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const query = searchParams.toString()
    const response = await this.request<{ data: Page[]; meta: PagesResponse['meta'] }>(`/pages/notices${query ? `?${query}` : ''}`)
    return { notices: response.data, meta: response.meta }
  }

  async getPageBySlug(slug: string) {
    const response = await this.request<{ data: Page }>(`/pages/slug/${slug}`)
    return { page: response.data }
  }

  // Admin pages endpoints
  async getAdminPages(params?: AdminPagesQueryParams) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.type) searchParams.set('type', params.type)
    if (params?.status) searchParams.set('status', params.status)

    const query = searchParams.toString()
    const response = await this.request<{ data: Page[]; meta: PagesResponse['meta'] }>(`/pages/admin${query ? `?${query}` : ''}`)
    return { pages: response.data, meta: response.meta }
  }

  async getPageStats() {
    const response = await this.request<{ data: PageStats }>('/pages/admin/stats')
    return response.data
  }

  async getPageById(id: string) {
    const response = await this.request<{ data: Page }>(`/pages/admin/${id}`)
    return { page: response.data }
  }

  async createPage(data: CreatePageData) {
    const response = await this.request<{ data: Page }>('/pages', {
      method: 'POST',
      body: data,
    })
    return { page: response.data }
  }

  async updatePage(id: string, data: UpdatePageData) {
    const response = await this.request<{ data: Page }>(`/pages/${id}`, {
      method: 'PUT',
      body: data,
    })
    return { page: response.data }
  }

  async deletePage(id: string) {
    return this.request<void>(`/pages/${id}`, {
      method: 'DELETE',
    })
  }
}

// Types
export interface AuthUser {
  id: string
  name: string
  email: string
  avatar?: string
  bio?: string
  title?: string
  github?: string
  twitter?: string
  linkedin?: string
  website?: string
  role: 'ADMIN' | 'USER'
}

export interface AuthorInfo {
  name: string
  title?: string
  bio?: string
  avatar?: string
  github?: string
  twitter?: string
  linkedin?: string
  website?: string
}

export interface UpdateProfileData {
  name?: string
  title?: string
  bio?: string
  avatar?: string
  github?: string
  twitter?: string
  linkedin?: string
  website?: string
}

export interface Post {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  coverImage?: string
  status: 'DRAFT' | 'PUBLISHED'
  category: Category
  tags: Tag[]
  author: AuthUser
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

export interface PostsResponse {
  posts: Post[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface PostsQueryParams {
  page?: number
  limit?: number
  category?: string
  tag?: string
  search?: string
  status?: 'DRAFT' | 'PUBLISHED'
  sortBy?: 'createdAt' | 'viewCount' | 'likeCount'
  featured?: boolean
}

export interface CreatePostData {
  title: string
  content: string
  excerpt?: string
  categoryId: string
  tagIds?: string[]
  status?: 'DRAFT' | 'PUBLISHED'
  coverImage?: string
  publishedAt?: string
}

export interface UpdatePostData extends Partial<CreatePostData> {}

export interface AdminStats {
  todayVisitors: number
  weeklyViews: number
  newComments: number
  totalPosts: number
  totalCategories: number
  pendingComments: number
}

export interface UrlMetadata {
  url: string
  title: string
  description: string
  image: string | null
  favicon: string | null
  siteName: string | null
}

// Page types
export interface Page {
  id: string
  slug: string
  title: string
  type: 'STATIC' | 'NOTICE'
  content: string
  excerpt?: string
  status: 'DRAFT' | 'PUBLISHED'
  badge?: string
  badgeColor?: string
  isPinned: boolean
  template?: string
  viewCount: number
  author: AuthUser
  createdAt: string
  updatedAt: string
  publishedAt?: string
}

export interface PagesResponse {
  pages: Page[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface PagesQueryParams {
  page?: number
  limit?: number
  type?: 'STATIC' | 'NOTICE'
}

export interface AdminPagesQueryParams extends PagesQueryParams {
  status?: 'DRAFT' | 'PUBLISHED'
}

export interface PageStats {
  total: number
  published: number
  drafts: number
  notices: number
  staticPages: number
}

export interface CreatePageData {
  title: string
  content: string
  excerpt?: string
  type?: 'STATIC' | 'NOTICE'
  status?: 'DRAFT' | 'PUBLISHED'
  badge?: string
  badgeColor?: string
  isPinned?: boolean
  template?: string
}

export interface UpdatePageData extends Partial<CreatePageData> {}

export const api = new ApiClient(API_BASE_URL)
export default api
