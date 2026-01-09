const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: unknown
  noCache?: boolean // Disable browser caching for view count tracking
}

export interface UploadImageResult {
  url: string
  size: number
  originalSize: number
  width: number
  height: number
  format: string
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
    const { method = 'GET', headers = {}, body, noCache } = options

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
      ...(noCache && { cache: 'no-store' as RequestCache }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }))
      throw new Error(error.message || `HTTP error! status: ${response.status}`)
    }

    // Handle 204 No Content (e.g., DELETE requests)
    if (response.status === 204) {
      return {} as T
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
    return this.request<{ data: Post }>(`/posts/${slug}`, { noCache: true })
  }

  async getAdjacentPosts(slug: string) {
    return this.request<{ data: { prev: { slug: string; title: string; coverImage: string | null } | null; next: { slug: string; title: string; coverImage: string | null } | null } }>(`/posts/${slug}/adjacent`)
  }

  async getRelatedPosts(slug: string) {
    return this.request<{ data: Array<{ id: string; slug: string; title: string; coverImage: string | null; publishedAt: string | null; category: { name: string; slug: string } }> }>(`/posts/${slug}/related`)
  }

  // Admin: Get post by ID (for editing drafts and published posts)
  async getPostById(id: string) {
    return this.request<{ data: Post }>(`/posts/admin/${id}`)
  }

  async getFeaturedPosts() {
    return this.request<{ posts: Post[] }>('/posts/featured')
  }

  async getTopViewedPost(category?: string) {
    const params = category ? `?category=${category}` : ''
    return this.request<{ data: Post | null }>(`/posts/top-viewed${params}`)
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

  async bulkDeletePosts(ids: string[]) {
    return this.request<{ data: { deletedCount: number } }>('/posts/bulk-delete', {
      method: 'POST',
      body: { ids },
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

  async createCategory(data: CreateCategoryData) {
    const response = await this.request<{ data: Category }>('/categories', {
      method: 'POST',
      body: data,
    })
    return response.data
  }

  async updateCategory(id: string, data: UpdateCategoryData) {
    const response = await this.request<{ data: Category }>(`/categories/${id}`, {
      method: 'PUT',
      body: data,
    })
    return response.data
  }

  async deleteCategory(id: string) {
    return this.request<void>(`/categories/${id}`, {
      method: 'DELETE',
    })
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

  async createTag(data: CreateTagData) {
    const response = await this.request<{ data: Tag }>('/tags', {
      method: 'POST',
      body: data,
    })
    return response.data
  }

  async updateTag(id: string, data: UpdateTagData) {
    const response = await this.request<{ data: Tag }>(`/tags/${id}`, {
      method: 'PUT',
      body: data,
    })
    return response.data
  }

  async deleteTag(id: string) {
    return this.request<void>(`/tags/${id}`, {
      method: 'DELETE',
    })
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

  // Dashboard stats
  async getDashboardStats() {
    const response = await this.request<{ data: DashboardStats }>('/stats/dashboard')
    return response.data
  }

  // Upload image
  async uploadImage(fileOrFormData: File | FormData, type?: 'avatar' | 'cover' | 'post'): Promise<UploadImageResult> {
    const formData = fileOrFormData instanceof FormData ? fileOrFormData : (() => {
      const fd = new FormData()
      fd.append('image', fileOrFormData)
      return fd
    })()

    const queryParam = type ? `?type=${type}` : ''
    const response = await fetch(`${this.baseUrl}/upload/image${queryParam}`, {
      method: 'POST',
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '업로드 실패' }))
      throw new Error(error.message || '이미지 업로드에 실패했습니다.')
    }

    const result = await response.json()
    return {
      url: result.data.url,
      size: result.data.size,
      originalSize: result.data.originalSize,
      width: result.data.width,
      height: result.data.height,
      format: result.data.format,
    }
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

  async getAdjacentNotices(slug: string) {
    const response = await this.request<{ data: { prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null } }>(`/pages/notices/${slug}/adjacent`)
    return response.data
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

  // Backup endpoints
  async createBackup(description?: string) {
    return this.request<{ data: BackupResult }>('/backups', {
      method: 'POST',
      body: { description },
    })
  }

  async listBackups() {
    const response = await this.request<{ data: BackupInfo[] }>('/backups')
    return response.data
  }

  async downloadBackup(fileName: string) {
    const response = await fetch(`${this.baseUrl}/backups/${fileName}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    })

    if (!response.ok) {
      throw new Error('백업 다운로드에 실패했습니다.')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  async getBackupInfo(fileName: string) {
    return this.request<{ data: BackupInfoDetail }>(`/backups/${fileName}/info`)
  }

  async restoreBackup(fileName: string) {
    return this.request<{ data: RestoreResult }>(`/backups/${fileName}/restore`, {
      method: 'POST',
    })
  }

  async deleteBackup(fileName: string) {
    return this.request<{ data: { success: boolean } }>(`/backups/${fileName}`, {
      method: 'DELETE',
    })
  }

  // Image management endpoints
  async getOrphanImages() {
    const response = await this.request<{ data: OrphanImagesResponse }>('/images/orphans')
    return response.data
  }

  async deleteOrphanImages() {
    const response = await this.request<{ data: DeleteOrphanResult }>('/images/orphans', {
      method: 'DELETE',
    })
    return response.data
  }

  // Comment endpoints
  async getRecentComments(limit: number = 5) {
    const response = await this.request<{ data: RecentComment[] }>(`/comments/recent?limit=${limit}`)
    return response.data
  }

  async getComments(postId: string) {
    const response = await this.request<{ data: CommentsResponse }>(`/comments/post/${postId}`)
    return response.data
  }

  async createComment(postId: string, data: CreateCommentData) {
    const response = await this.request<{ data: Comment }>(`/comments/post/${postId}`, {
      method: 'POST',
      body: data,
    })
    return response.data
  }

  async updateComment(commentId: string, data: UpdateCommentData) {
    const response = await this.request<{ data: Comment }>(`/comments/${commentId}`, {
      method: 'PUT',
      body: data,
    })
    return response.data
  }

  async deleteComment(commentId: string, guestPassword?: string) {
    const response = await this.request<{ data: { success: boolean; message: string } }>(`/comments/${commentId}`, {
      method: 'DELETE',
      body: guestPassword ? { guestPassword } : undefined,
    })
    return response.data
  }

  // User comment endpoints
  async getMyComments(params?: { page?: number; limit?: number; sort?: string; order?: 'asc' | 'desc' }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.order) searchParams.set('order', params.order)

    const query = searchParams.toString()
    return this.request<MyCommentsResponse>(`/comments/me${query ? `?${query}` : ''}`)
  }

  // Admin comment endpoints
  async getAdminComments(params?: { page?: number; limit?: number; includeDeleted?: boolean }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.includeDeleted) searchParams.set('includeDeleted', 'true')

    const query = searchParams.toString()
    return this.request<AdminCommentsResponse>(`/comments/admin${query ? `?${query}` : ''}`)
  }

  async adminDeleteComment(commentId: string) {
    const response = await this.request<{ data: { success: boolean; message: string } }>(`/comments/admin/${commentId}`, {
      method: 'DELETE',
    })
    return response.data
  }

  async adminBulkDeleteComments(ids: string[]) {
    return this.request<{ data: { deletedCount: number; message: string } }>('/comments/admin/bulk-delete', {
      method: 'POST',
      body: { ids },
    })
  }

  // Draft endpoints
  async getDrafts() {
    const response = await this.request<{ data: Draft[] }>('/drafts')
    return { drafts: response.data }
  }

  async getDraftById(id: string) {
    const response = await this.request<{ data: Draft }>(`/drafts/${id}`)
    return { draft: response.data }
  }

  async createDraft(data: CreateDraftData) {
    const response = await this.request<{ data: Draft }>('/drafts', {
      method: 'POST',
      body: data,
    })
    return { draft: response.data }
  }

  async updateDraft(id: string, data: UpdateDraftData) {
    const response = await this.request<{ data: Draft }>(`/drafts/${id}`, {
      method: 'PUT',
      body: data,
    })
    return { draft: response.data }
  }

  async deleteDraft(id: string) {
    return this.request<void>(`/drafts/${id}`, {
      method: 'DELETE',
    })
  }

  async publishDraft(id: string, data: PublishDraftData) {
    const response = await this.request<{ data: Post }>(`/drafts/${id}/publish`, {
      method: 'POST',
      body: data,
    })
    return { post: response.data }
  }

  // Like endpoints
  async toggleLike(postId: string) {
    const response = await this.request<{ data: LikeResponse }>(`/likes/${postId}`, {
      method: 'POST',
    })
    return response.data
  }

  async checkLikeStatus(postId: string) {
    const response = await this.request<{ data: LikeResponse }>(`/likes/${postId}`)
    return response.data
  }

  // Bookmark endpoints
  async toggleBookmark(postId: string) {
    const response = await this.request<{ data: BookmarkResponse }>(`/bookmarks/${postId}`, {
      method: 'POST',
    })
    return response.data
  }

  async checkBookmarkStatus(postId: string) {
    const response = await this.request<{ data: BookmarkResponse }>(`/bookmarks/${postId}`)
    return response.data
  }

  async getMyBookmarks(params?: { page?: number; limit?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const query = searchParams.toString()
    const response = await this.request<MyBookmarksResponse>(`/bookmarks${query ? `?${query}` : ''}`)
    return response.data
  }

  async removeBookmark(postId: string) {
    return this.request<{ message: string }>(`/bookmarks/${postId}`, {
      method: 'DELETE',
    })
  }

  // User profile endpoints
  async getMyProfile() {
    const response = await this.request<{ data: UserProfile }>('/users/me')
    return response.data
  }

  async updateMyProfile(data: { name?: string; avatar?: string | null; bio?: string | null }) {
    const response = await this.request<{ data: UserProfile }>('/users/me', {
      method: 'PUT',
      body: data,
    })
    return response.data
  }

  // Analytics endpoints
  async getWeeklyVisitors() {
    const response = await this.request<{ data: WeeklyVisitorsResponse }>('/analytics/weekly')
    return response.data
  }

  async getDetailedAnalytics(period: string = '7d') {
    const response = await this.request<DetailedAnalyticsResponse>(`/analytics/detailed?period=${period}`)
    return response
  }

  async getPageAnalytics(path: string, period: string = '7d') {
    const response = await this.request<PageAnalyticsResponse>(`/analytics/page?path=${encodeURIComponent(path)}&period=${period}`)
    return response
  }

  // User management endpoints
  async getUsers(params?: UsersQueryParams) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.search) searchParams.set('search', params.search)
    if (params?.status) searchParams.set('status', params.status)

    const query = searchParams.toString()
    return this.request<UsersResponse>(`/users${query ? `?${query}` : ''}`)
  }

  async getUserStats() {
    const response = await this.request<{ data: UserStats }>('/users/stats')
    return response.data
  }

  async updateUserStatus(userId: string, status: UserStatus) {
    const response = await this.request<{ data: AdminUser }>(`/users/${userId}/status`, {
      method: 'PATCH',
      body: { status },
    })
    return response.data
  }

  async deleteUser(userId: string) {
    return this.request<void>(`/users/${userId}`, {
      method: 'DELETE',
    })
  }

  async getSignupTrend(period: SignupTrendPeriod = 'daily') {
    const response = await this.request<{ data: SignupTrendData }>(`/users/signup-trend?period=${period}`)
    return response.data
  }

  async getSignupPattern() {
    const response = await this.request<{ data: SignupPatternData }>('/users/signup-pattern')
    return response.data
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
  status?: 'ACTIVE' | 'SUSPENDED'
  createdAt: string
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
  status: 'PUBLIC' | 'PRIVATE'
  featured: boolean
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

export interface Draft {
  id: string
  title?: string
  content: string
  excerpt?: string
  coverImage?: string
  categoryId?: string
  tagIds: string[]
  authorId: string
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  color?: string
  postCount: number
  privateCount?: number
}

export interface CreateCategoryData {
  name: string
  slug?: string
  description?: string
  icon?: string
  color?: string
}

export interface UpdateCategoryData extends Partial<CreateCategoryData> {}

export interface Tag {
  id: string
  name: string
  slug: string
  postCount: number
}

export interface CreateTagData {
  name: string
  slug?: string
}

export interface UpdateTagData extends Partial<CreateTagData> {}

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
  status?: 'PUBLISHED' | 'PRIVATE' | 'PUBLIC' | 'ALL'
  sortBy?: 'publishedAt' | 'viewCount' | 'likeCount'
  featured?: boolean
}

export interface CreatePostData {
  title: string
  content: string
  excerpt?: string
  categoryId: string
  tagIds?: string[]
  status?: 'PUBLIC' | 'PRIVATE'
  featured?: boolean
  coverImage?: string
  publishedAt?: string
}

export interface CreateDraftData {
  title?: string
  content?: string
  excerpt?: string
  coverImage?: string
  categoryId?: string
  tagIds?: string[]
}

export interface UpdateDraftData extends Partial<CreateDraftData> {}

export interface PublishDraftData {
  status?: 'PUBLIC' | 'PRIVATE'
  categoryId?: string
  tagIds?: string[]
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

export interface DashboardStats {
  stats: {
    totalPosts: number
    publishedPosts: number
    draftPosts: number
    totalComments: number
    recentComments: number
    newComments: number
    totalViews: number
    totalLikes: number
    totalUsers: number
  }
  categories: {
    id: string
    name: string
    slug: string
    color: string | null
    postCount: number
  }[]
  tags: {
    id: string
    name: string
    slug: string
    postCount: number
  }[]
  pages: {
    static: number
    notice: number
  }
  images: {
    total: number
    totalSize: number
    linked: number
    orphaned: number
    orphanSize: number
  }
  backups: {
    name: string
    createdAt: string | null
  }[]
  recentPosts: {
    id: string
    title: string
    slug: string
    viewCount: number
    commentCount: number
    createdAt: string
    category: {
      name: string
      color: string | null
    }
  }[]
  recentDrafts: {
    id: string
    title: string
    excerpt: string
    createdAt: string
    updatedAt: string
  }[]
  recentComments: {
    id: string
    content: string
    authorName: string
    authorAvatar: string | null
    createdAt: string
    post: {
      id: string
      title: string
      slug: string
    }
  }[]
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

// Backup types
export interface BackupInfo {
  name: string
  fullPath: string
  createdAt: string | null
}

export interface BackupResult {
  success: boolean
  fileName: string
  objectPath: string
  createdAt: string
  stats: {
    users: number
    categories: number
    tags: number
    posts: number
    drafts: number
    pages: number
    comments: number
  }
}

export interface BackupInfoDetail {
  fileName: string
  version: string
  description: string | null
  createdAt: string
  stats: {
    users: number
    categories: number
    tags: number
    posts: number
    drafts: number
    pages: number
    comments: number
  }
}

export interface RestoreResult {
  success: boolean
  message: string
  restoredAt: string
  stats: {
    categories: number
    tags: number
    posts: number
    drafts: number
    pages: number
    comments: number
  }
}

// Image types
export interface OrphanImage {
  id: string
  url: string
  objectName: string
  filename: string
  size: number
  createdAt: string
}

export interface ImageStats {
  total: number
  linked: number
  usedInDrafts: number
  orphaned: number
  totalSize: number
}

export interface OrphanImagesResponse {
  orphans: OrphanImage[]
  stats: ImageStats
}

export interface DeleteOrphanResult {
  deleted: number
  freedSpace: number
}

// Comment types
export interface RecentComment {
  id: string
  content: string
  authorName: string
  authorAvatar: string | null
  createdAt: string
  post: {
    id: string
    title: string
    slug: string
  }
}

export interface Comment {
  id: string
  content: string
  postId: string
  parentId: string | null
  isPrivate: boolean
  isDeleted: boolean
  author: {
    id: string
    name: string
    avatar: string | null
  } | null
  guestName: string | null
  isOwner: boolean
  createdAt: string
  updatedAt?: string
  replyCount: number
  replies?: Comment[]
}

export interface CommentsResponse {
  comments: Comment[]
  totalCount: number
}

export interface CreateCommentData {
  content: string
  guestName?: string
  guestPassword?: string
  parentId?: string
  isPrivate?: boolean
}

export interface UpdateCommentData {
  content: string
  guestPassword?: string
  isPrivate?: boolean
}

export interface AdminComment {
  id: string
  content: string
  isPrivate: boolean
  isDeleted: boolean
  author: {
    id: string
    name: string
    avatar: string | null
  } | null
  guestName: string | null
  post: {
    id: string
    title: string
    slug: string
  }
  parentId: string | null
  createdAt: string
}

export interface AdminCommentsResponse {
  data: AdminComment[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface MyComment {
  id: string
  content: string
  isPrivate: boolean
  post: {
    id: string
    title: string
    slug: string
  }
  parentId: string | null
  replyCount: number
  createdAt: string
  updatedAt: string
}

export interface MyCommentsResponse {
  data: MyComment[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface LikeResponse {
  liked: boolean
  likeCount: number
}

export interface BookmarkResponse {
  bookmarked: boolean
}

export interface BookmarkedPost {
  id: string
  slug: string
  title: string
  excerpt: string
  coverImage: string | null
  viewCount: number
  likeCount: number
  readingTime: number
  createdAt: string
  publishedAt: string | null
  category: {
    id: string
    name: string
    slug: string
  }
  tags: {
    id: string
    name: string
    slug: string
  }[]
  commentCount: number
  bookmarkedAt: string
}

export interface MyBookmarksResponse {
  data: {
    posts: BookmarkedPost[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

export interface UserProfile {
  id: string
  email: string
  name: string
  avatar: string | null
  bio: string | null
  title: string | null
  github: string | null
  twitter: string | null
  linkedin: string | null
  website: string | null
  role: string
  createdAt: string
}

export interface WeeklyVisitorsResponse {
  daily: { date: string; visitors: number }[]
  total: number
  updatedAt?: string
  configured: boolean
  cached?: boolean
  stale?: boolean
  error?: string
}

export interface OverviewData {
  visitors: number
  pageViews: number
  avgSessionDuration: number
  bounceRate: number
  newUsers: number
  returningUsers: number
}

export interface DetailedAnalyticsData {
  overview: OverviewData
  previousOverview: OverviewData | null
  topPages: { path: string; title: string; views: number; avgTime: number }[]
  locations: { country: string; city: string; visitors: number }[]
  devices: { category: string; visitors: number }[]
  browsers: { name: string; visitors: number }[]
  trafficSources: { source: string; visitors: number }[]
  hourlyStats: { hour: number; visitors: number }[]
  dailyStats: { date: string; visitors: number; pageViews: number }[]
  updatedAt: string
}

export interface DetailedAnalyticsResponse {
  data: DetailedAnalyticsData | null
  configured: boolean
  cached?: boolean
  stale?: boolean
  period?: string
  error?: string
}

export interface PageAnalyticsData {
  pagePath: string
  pageTitle: string
  totalViews: number
  totalVisitors: number
  avgSessionDuration: number
  locations: { country: string; city: string; visitors: number }[]
  devices: { category: string; visitors: number }[]
  browsers: { name: string; visitors: number }[]
  trafficSources: { source: string; visitors: number }[]
  referrers: { referrer: string; visitors: number }[]
}

export interface PageAnalyticsResponse {
  data: PageAnalyticsData | null
  configured: boolean
  error?: string
}

// User management types
export type UserStatus = 'ACTIVE' | 'SUSPENDED'

export interface AdminUser {
  id: string
  email: string
  name: string
  avatar: string | null
  role: 'ADMIN' | 'USER'
  status: UserStatus
  commentCount: number
  createdAt: string
}

export interface UsersQueryParams {
  page?: number
  limit?: number
  search?: string
  status?: UserStatus | 'all'
}

export interface UsersResponse {
  data: AdminUser[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface UserStats {
  totalUsers: number
  suspendedUsers: number
  activeUsers: number
  todayNewUsers: number
  yesterdayNewUsers: number
  thisWeekNewUsers: number
  lastWeekNewUsers: number
  thisMonthNewUsers: number
  lastMonthNewUsers: number
}

export type SignupTrendPeriod = 'daily' | 'weekly' | 'monthly'

export interface SignupTrendData {
  trend: { date: string; count: number }[]
  summary: {
    total: number
    average: number
    max: { date: string; count: number }
  }
}

export interface SignupPatternData {
  pattern: { day: string; count: number; average: number }[]
  peakDay: string
}

export const api = new ApiClient(API_BASE_URL)
export default api
