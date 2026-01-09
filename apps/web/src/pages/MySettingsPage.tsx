import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'

export default function MySettingsPage() {
  const { user, refreshUser } = useAuth()
  const isInitializedRef = useRef(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    bio: '',
  })

  // 초기 로드 시에만 user 데이터로 폼 초기화
  useEffect(() => {
    if (user && !isInitializedRef.current) {
      setFormData({
        name: user.name || '',
        bio: user.bio || '',
      })
      isInitializedRef.current = true
    }
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)

    try {
      const profileData = {
        name: formData.name || '',
        bio: formData.bio || '',
      }
      const result = await api.updateMyProfile(profileData)
      if (result) {
        setFormData({
          name: result.name || '',
          bio: result.bio || '',
        })
      }
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

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-slate-500">로그인이 필요합니다.</p>
        <Link to="/login" className="text-primary hover:underline mt-2 inline-block">
          로그인하기
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col gap-4 md:gap-8">
        {/* Header */}
        <div className="flex flex-col gap-1 md:gap-2 pb-3 md:pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-2xl">settings</span>
            <h1 className="text-xl md:text-3xl font-bold tracking-tight">설정</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-lg">프로필 정보를 관리하세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 md:gap-8">
          {/* Profile Section */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl md:rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800">
            <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">프로필 정보</h2>

            {/* Avatar (Read-only) */}
            <div className="flex items-center gap-4 mb-4 md:mb-6">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt="Avatar"
                  className="size-16 md:size-20 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="size-16 md:size-20 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl md:text-3xl text-slate-400">person</span>
                </div>
              )}
              <p className="text-xs text-slate-400">프로필 사진은 Google 계정에서 가져옵니다.</p>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label htmlFor="name" className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                이름
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                maxLength={50}
                className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs md:text-sm focus:border-primary focus:ring-primary/20 transition-shadow py-2 md:py-2.5"
                placeholder="표시될 이름"
              />
            </div>

            {/* Bio */}
            <div>
              <label htmlFor="bio" className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                소개
              </label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                maxLength={200}
                rows={3}
                className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs md:text-sm focus:border-primary focus:ring-primary/20 transition-shadow resize-none"
                placeholder="간단한 자기소개 (200자 이내)"
              />
              <p className="text-xs text-slate-400 mt-1">{formData.bio.length}/200</p>
            </div>
          </div>

          {/* Account Info (Read-only) */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl md:rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800">
            <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">계정 정보</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs md:text-sm text-slate-500">이메일</span>
                <span className="text-xs md:text-sm font-medium">{user.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs md:text-sm text-slate-500">가입일</span>
                <span className="text-xs md:text-sm font-medium">
                  {new Date(user.createdAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs md:text-sm text-slate-500">계정 유형</span>
                <span className="text-xs md:text-sm font-medium">Google 계정</span>
              </div>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`px-4 py-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  저장 중...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  저장하기
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
