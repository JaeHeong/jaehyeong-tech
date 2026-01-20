import { memo, useRef } from 'react'
import type { Category, Tag } from '../../services/api'

interface PostFormData {
  title: string
  content: string
  excerpt: string
  categoryId: string
  tagIds: string[]
  status: 'PUBLIC' | 'PRIVATE'
  coverImage: string
  publishedAt: string
}

interface EditorSidebarProps {
  formData: PostFormData
  categories: Category[]
  tags: Tag[]
  isUploadingCover: boolean
  newTagName: string
  isCreatingTag: boolean
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  onTagToggle: (tagId: string) => void
  onCreateTag: () => void
  onDeleteTag: (tagId: string, tagName: string) => void
  onNewTagNameChange: (value: string) => void
  onCoverSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveCover: () => void
  onStatusChange: (status: 'PUBLIC' | 'PRIVATE') => void
}

function EditorSidebar({
  formData,
  categories,
  tags,
  isUploadingCover,
  newTagName,
  isCreatingTag,
  onInputChange,
  onTagToggle,
  onCreateTag,
  onDeleteTag,
  onNewTagNameChange,
  onCoverSelect,
  onRemoveCover,
  onStatusChange,
}: EditorSidebarProps) {
  const coverInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Category */}
      <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
        <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 md:mb-3">
          카테고리 <span className="text-red-500">*</span>
        </label>
        <select
          name="categoryId"
          value={formData.categoryId}
          onChange={onInputChange}
          className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg p-2.5 md:p-3 border-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs md:text-sm"
        >
          <option value="">카테고리 선택</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
        <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 md:mb-3">
          태그
        </label>
        <div className="flex flex-wrap gap-1.5 md:gap-2 mb-3">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className={`group relative flex items-center gap-1 pl-2.5 md:pl-3 pr-1.5 md:pr-2 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs font-medium transition-colors cursor-pointer ${
                formData.tagIds.includes(tag.id)
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              onClick={() => onTagToggle(tag.id)}
            >
              <span>{tag.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteTag(tag.id, tag.name)
                }}
                className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                title="태그 삭제"
              >
                <span className="material-symbols-outlined text-[12px]">close</span>
              </button>
            </div>
          ))}
        </div>
        {/* Add new tag */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => onNewTagNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onCreateTag()
              }
            }}
            placeholder="새 태그 입력..."
            className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 text-xs border border-transparent focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={onCreateTag}
            disabled={!newTagName.trim() || isCreatingTag}
            className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isCreatingTag ? (
              <span className="material-symbols-outlined text-[14px] animate-spin">
                progress_activity
              </span>
            ) : (
              <span className="material-symbols-outlined text-[14px]">add</span>
            )}
            추가
          </button>
        </div>
      </div>

      {/* Visibility */}
      <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
        <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 md:mb-3">
          공개 설정
        </label>
        <div className="flex gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={() => onStatusChange('PUBLIC')}
            className={`flex-1 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors flex items-center justify-center gap-1 md:gap-2 ${
              formData.status === 'PUBLIC'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 ring-2 ring-green-500'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] md:text-[18px]">public</span>
            공개
          </button>
          <button
            type="button"
            onClick={() => onStatusChange('PRIVATE')}
            className={`flex-1 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors flex items-center justify-center gap-1 md:gap-2 ${
              formData.status === 'PRIVATE'
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 ring-2 ring-slate-500'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] md:text-[18px]">lock</span>
            비공개
          </button>
        </div>
        <p className="text-[10px] md:text-xs text-slate-500 mt-1.5 md:mt-2">
          {formData.status === 'PUBLIC' ? '모든 방문자에게 공개됩니다.' : '관리자만 볼 수 있습니다.'}
        </p>
      </div>

      {/* Publish Date */}
      <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
        <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 md:mb-3">
          발행일
        </label>
        <input
          type="datetime-local"
          name="publishedAt"
          value={formData.publishedAt}
          onChange={onInputChange}
          className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg p-2.5 md:p-3 border-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs md:text-sm"
        />
        <p className="text-[10px] md:text-xs text-slate-500 mt-1.5 md:mt-2">
          게시물이 발행된 날짜를 수정할 수 있습니다.
        </p>
      </div>

      {/* Cover Image */}
      <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
        <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 md:mb-3">
          커버 이미지
        </label>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={onCoverSelect}
          className="hidden"
        />
        {formData.coverImage ? (
          <div className="space-y-2 md:space-y-3">
            <div className="aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 relative group">
              <img
                src={formData.coverImage}
                alt="Cover preview"
                className="w-full h-full object-cover"
              />
              {/* Loading overlay when uploading new cover */}
              {isUploadingCover && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[32px] md:text-[40px] text-white animate-spin">
                    progress_activity
                  </span>
                  <span className="text-white text-xs md:text-sm font-medium">
                    이미지 최적화 중...
                  </span>
                </div>
              )}
              {/* Hover controls */}
              {!isUploadingCover && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="p-1.5 md:p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    title="이미지 변경"
                  >
                    <span className="material-symbols-outlined text-white text-[18px] md:text-[20px]">
                      edit
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onRemoveCover}
                    className="p-1.5 md:p-2 bg-white/20 hover:bg-red-500/70 rounded-lg transition-colors"
                    title="이미지 삭제"
                  >
                    <span className="material-symbols-outlined text-white text-[18px] md:text-[20px]">
                      delete
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={isUploadingCover}
            className="w-full aspect-video rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary dark:hover:border-primary bg-slate-50 dark:bg-slate-800/50 transition-colors flex flex-col items-center justify-center gap-1.5 md:gap-2 text-slate-500 dark:text-slate-400 hover:text-primary"
          >
            {isUploadingCover ? (
              <>
                <span className="material-symbols-outlined text-[28px] md:text-[32px] animate-spin">
                  progress_activity
                </span>
                <span className="text-xs md:text-sm font-medium">업로드 중...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[28px] md:text-[32px]">
                  add_photo_alternate
                </span>
                <span className="text-xs md:text-sm font-medium">커버 이미지 선택</span>
                <span className="text-[10px] md:text-xs">JPG, PNG, GIF, WebP (최대 50MB)</span>
              </>
            )}
          </button>
        )}
        <p className="text-[10px] md:text-xs text-slate-500 mt-1.5 md:mt-2">
          권장 크기: 1200×675px (16:9 비율)
        </p>
      </div>

      {/* Editor Tips */}
      <div className="hidden md:block bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
        <h3 className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 md:mb-3 flex items-center gap-1.5 md:gap-2">
          <span className="material-symbols-outlined text-[16px] md:text-[18px]">lightbulb</span>
          에디터 팁
        </h3>
        <ul className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 space-y-1.5 md:space-y-2">
          <li className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">
              /
            </kbd>
            <span>슬래시 메뉴로 블록 추가</span>
          </li>
          <li className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">
              ```
            </kbd>
            <span>코드블록 (```js 언어지정)</span>
          </li>
          <li className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">
              Ctrl+B
            </kbd>
            <span>굵게</span>
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">
              Ctrl+I
            </kbd>
            <span>기울임</span>
          </li>
          <li className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">
              Ctrl+Shift+S
            </kbd>
            <span>취소선</span>
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">
              Ctrl+Shift+H
            </kbd>
            <span>형광펜</span>
          </li>
          <li className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">
              Ctrl+Shift+L
            </kbd>
            <span>좌측</span>
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">
              Ctrl+Shift+E
            </kbd>
            <span>가운데</span>
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">
              Ctrl+Shift+R
            </kbd>
            <span>우측</span>
          </li>
          <li className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">
              Ctrl+Z
            </kbd>
            <span>실행취소</span>
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-mono">
              Ctrl+Shift+Z
            </kbd>
            <span>다시실행</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default memo(EditorSidebar)
