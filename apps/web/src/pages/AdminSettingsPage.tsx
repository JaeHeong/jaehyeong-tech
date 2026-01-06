import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'

export default function AdminSettingsPage() {
  const { user, refreshUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    title: '',
    bio: '',
    avatar: '',
    github: '',
    twitter: '',
    linkedin: '',
    website: '',
  })

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        title: user.title || '',
        bio: user.bio || '',
        avatar: user.avatar || '',
        github: user.github || '',
        twitter: user.twitter || '',
        linkedin: user.linkedin || '',
        website: user.website || '',
      })
    }
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 1024 * 1024) {
      setMessage({ type: 'error', text: '파일 크기는 1MB 이하여야 합니다.' })
      return
    }

    setIsLoading(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('image', file)
      const response = await api.uploadImage(uploadFormData)
      setFormData((prev) => ({ ...prev, avatar: response.url }))
      setMessage({ type: 'success', text: '프로필 사진이 업로드되었습니다.' })
    } catch {
      setMessage({ type: 'error', text: '이미지 업로드에 실패했습니다.' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAvatarDelete = () => {
    setFormData((prev) => ({ ...prev, avatar: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)

    try {
      await api.updateProfile(formData)
      if (refreshUser) {
        await refreshUser()
      }
      setMessage({ type: 'success', text: '설정이 저장되었습니다.' })
    } catch {
      setMessage({ type: 'error', text: '설정 저장에 실패했습니다.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-3xl font-bold tracking-tight">프로필 설정</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            블로그에 표시될 프로필 정보와 소셜 링크를 관리하세요.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">
                {message.type === 'success' ? 'check_circle' : 'error'}
              </span>
              {message.text}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">person</span>
              기본 정보
            </h2>
            <div className="space-y-6">
              {/* Profile Photo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  프로필 사진
                </label>
                <div className="flex items-center gap-6">
                  <div
                    className="size-24 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center"
                    style={formData.avatar ? { backgroundImage: `url('${formData.avatar}')` } : {}}
                  >
                    {!formData.avatar && (
                      <span className="material-symbols-outlined text-slate-400 text-[40px]">person</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors shadow-sm shadow-primary/20 disabled:opacity-50"
                      >
                        {isLoading ? '업로드 중...' : '사진 변경'}
                      </button>
                      {formData.avatar && (
                        <button
                          type="button"
                          onClick={handleAvatarDelete}
                          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">JPG, GIF or PNG. 최대 1MB.</p>
                  </div>
                </div>
              </div>

              {/* Name & Title */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    이름 (표시명)
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Jaehyeong"
                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-sm focus:border-primary focus:ring-primary/20 transition-shadow py-2.5"
                  />
                </div>
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    직업 / 타이틀
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="DevOps Engineer"
                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-sm focus:border-primary focus:ring-primary/20 transition-shadow py-2.5"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  소개 글
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="자신을 소개하는 짧은 글을 작성해주세요."
                  maxLength={200}
                  className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-sm focus:border-primary focus:ring-primary/20 transition-shadow py-2.5 min-h-[100px]"
                />
                <p className="text-xs text-slate-500 mt-1 text-right">{formData.bio.length} / 200자</p>
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">share</span>
              소셜 링크
            </h2>
            <div className="space-y-4">
              {/* GitHub */}
              <div>
                <label htmlFor="github" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  GitHub
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                  </div>
                  <input
                    type="url"
                    id="github"
                    name="github"
                    value={formData.github}
                    onChange={handleChange}
                    placeholder="https://github.com/username"
                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-sm pl-10 focus:border-primary focus:ring-primary/20 transition-shadow py-2.5"
                  />
                </div>
              </div>

              {/* Old Blog (Tistory) */}
              <div>
                <label htmlFor="twitter" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  구 블로그
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <span className="material-symbols-outlined text-slate-400 text-[20px]">history</span>
                  </div>
                  <input
                    type="url"
                    id="twitter"
                    name="twitter"
                    value={formData.twitter}
                    onChange={handleChange}
                    placeholder="https://example.tistory.com"
                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-sm pl-10 focus:border-primary focus:ring-primary/20 transition-shadow py-2.5"
                  />
                </div>
              </div>

              {/* LinkedIn */}
              <div>
                <label htmlFor="linkedin" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  LinkedIn
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                    </svg>
                  </div>
                  <input
                    type="url"
                    id="linkedin"
                    name="linkedin"
                    value={formData.linkedin}
                    onChange={handleChange}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-sm pl-10 focus:border-primary focus:ring-primary/20 transition-shadow py-2.5"
                  />
                </div>
              </div>

              {/* Website */}
              <div>
                <label htmlFor="website" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Website
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <span className="material-symbols-outlined text-slate-400 text-[20px]">language</span>
                  </div>
                  <input
                    type="url"
                    id="website"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="https://yourwebsite.com"
                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-sm pl-10 focus:border-primary focus:ring-primary/20 transition-shadow py-2.5"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-6 py-2.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-lg shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
