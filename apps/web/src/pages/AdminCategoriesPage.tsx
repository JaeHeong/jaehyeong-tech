import { useState, useEffect, useMemo } from 'react'
import api, { Category, CreateCategoryData } from '../services/api'

const ITEMS_PER_PAGE = 9

interface CategoryFormData {
  name: string
  slug: string
  description: string
  icon: string
  color: string
}

interface ApiError {
  message: string
}

const defaultColors = ['blue', 'purple', 'indigo', 'orange', 'green', 'pink', 'teal', 'red']
const defaultIcons = [
  'settings_suggest', 'psychology', 'anchor', 'cloud', 'smart_toy',
  'code_blocks', 'monitoring', 'lock', 'terminal', 'data_object',
  'database', 'api', 'storage', 'memory', 'hub'
]

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; category: Category | null }>({
    isOpen: false,
    category: null,
  })
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    slug: '',
    description: '',
    icon: 'folder',
    color: 'blue',
  })
  const [currentPage, setCurrentPage] = useState(1)

  // Client-side pagination
  const totalPages = Math.ceil(categories.length / ITEMS_PER_PAGE)
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return categories.slice(start, start + ITEMS_PER_PAGE)
  }, [categories, currentPage])

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setIsLoading(true)
    try {
      const { categories } = await api.getCategories()
      setCategories(categories)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setFormData({
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        icon: category.icon || 'folder',
        color: category.color || 'blue',
      })
    } else {
      setEditingCategory(null)
      setFormData({
        name: '',
        slug: '',
        description: '',
        icon: 'folder',
        color: 'blue',
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCategory(null)
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: editingCategory ? formData.slug : generateSlug(name),
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSaving(true)

    try {
      const categoryData: CreateCategoryData = {
        name: formData.name,
        slug: formData.slug || undefined,
        description: formData.description || undefined,
        icon: formData.icon || undefined,
        color: formData.color || undefined,
      }

      if (editingCategory) {
        const updated = await api.updateCategory(editingCategory.id, categoryData)
        setCategories(categories.map((c) => (c.id === editingCategory.id ? { ...updated, postCount: c.postCount } : c)))
      } else {
        const created = await api.createCategory(categoryData)
        setCategories([...categories, { ...created, postCount: 0 }])
      }
      handleCloseModal()
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || '카테고리 저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.category) return
    setError(null)
    setIsDeleting(true)

    try {
      await api.deleteCategory(deleteModal.category.id)
      setCategories(categories.filter((c) => c.id !== deleteModal.category?.id))
      setDeleteModal({ isOpen: false, category: null })
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError.message || '카테고리 삭제에 실패했습니다.')
      setDeleteModal({ isOpen: false, category: null })
    } finally {
      setIsDeleting(false)
    }
  }

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-500',
    purple: 'bg-purple-500/10 text-purple-500',
    indigo: 'bg-indigo-500/10 text-indigo-500',
    orange: 'bg-orange-500/10 text-orange-500',
    green: 'bg-green-500/10 text-green-500',
    pink: 'bg-pink-500/10 text-pink-500',
    teal: 'bg-teal-500/10 text-teal-500',
    red: 'bg-red-500/10 text-red-500',
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold">카테고리 관리</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            블로그 카테고리를 관리합니다.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          새 카테고리
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Categories Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">
            progress_activity
          </span>
        </div>
      ) : categories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedCategories.map((category) => (
            <div
              key={category.id}
              className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${colorClasses[category.color || 'blue']}`}>
                  <span className="material-symbols-outlined text-[28px]">
                    {category.icon || 'folder'}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleOpenModal(category)}
                    className="p-2 text-slate-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="수정"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    onClick={() => setDeleteModal({ isOpen: true, category })}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="삭제"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold mb-1">{category.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                {category.description || '설명 없음'}
              </p>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>/{category.slug}</span>
                <span className="font-medium">{category.postCount} Posts</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600 mb-4 block">
            category
          </span>
          <p className="text-slate-500 dark:text-slate-400 mb-4">카테고리가 없습니다.</p>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            첫 번째 카테고리 만들기
          </button>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number
              if (totalPages <= 5) {
                page = i + 1
              } else if (currentPage <= 3) {
                page = i + 1
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i
              } else {
                page = currentPage - 2 + i
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-primary text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {page}
                </button>
              )
            })}
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCloseModal}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">
                {editingCategory ? '카테고리 수정' : '새 카테고리'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5">이름</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  placeholder="카테고리 이름"
                  required
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium mb-1.5">슬러그</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  placeholder="category-slug"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1.5">설명</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20 resize-none"
                  rows={3}
                  placeholder="카테고리 설명"
                />
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium mb-1.5">아이콘</label>
                <div className="flex flex-wrap gap-2">
                  {defaultIcons.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`p-2 rounded-lg border transition-colors ${
                        formData.icon === icon
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{icon}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium mb-1.5">색상</label>
                <div className="flex flex-wrap gap-2">
                  {defaultColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        formData.color === color
                          ? 'border-slate-900 dark:border-white scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: `var(--color-${color}-500, ${color})` }}
                    >
                      <span
                        className={`block w-full h-full rounded-md bg-${color}-500`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <label className="block text-sm font-medium mb-3">미리보기</label>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${colorClasses[formData.color]}`}>
                      <span className="material-symbols-outlined text-[28px]">{formData.icon}</span>
                    </div>
                    <div>
                      <h4 className="font-bold">{formData.name || '카테고리 이름'}</h4>
                      <p className="text-sm text-slate-500">{formData.description || '설명'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {isSaving ? '저장 중...' : editingCategory ? '수정' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteModal({ isOpen: false, category: null })}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <h3 className="text-lg font-bold">카테고리 삭제</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              <strong className="text-slate-900 dark:text-white">
                "{deleteModal.category?.name}"
              </strong>
              을(를) 삭제하시겠습니까? 이 카테고리에 속한 게시글은 영향을 받을 수 있습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteModal({ isOpen: false, category: null })}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
