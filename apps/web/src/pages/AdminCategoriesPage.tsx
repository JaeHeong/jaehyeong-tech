import { useState, useEffect } from 'react'
import api, { Category } from '../services/api'

interface CategoryFormData {
  name: string
  slug: string
  description: string
  icon: string
  color: string
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

    // Note: This would need a backend endpoint for create/update categories
    // For now, we'll just show a placeholder message
    alert('카테고리 API 엔드포인트가 필요합니다. 백엔드 구현이 필요합니다.')
    handleCloseModal()
  }

  const handleDelete = async () => {
    if (!deleteModal.category) return

    // Note: This would need a backend endpoint
    alert('카테고리 삭제 API 엔드포인트가 필요합니다.')
    setDeleteModal({ isOpen: false, category: null })
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

      {/* Categories Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">
            progress_activity
          </span>
        </div>
      ) : categories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
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
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors"
                >
                  {editingCategory ? '수정' : '생성'}
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
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
