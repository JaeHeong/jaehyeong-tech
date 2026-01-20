import { memo } from 'react'
import { Link } from 'react-router-dom'

interface EditorHeaderProps {
  isEditing: boolean
  postSlug: string | null
  isDirty: boolean
  isSaving: boolean
  isDeleting: boolean
  isAutoSaving: boolean
  lastAutoSave: Date | null
  onDelete: () => void
  onPreview: () => void
  onSubmit: () => void
}

function EditorHeader({
  isEditing,
  postSlug,
  isDirty,
  isSaving,
  isDeleting,
  isAutoSaving,
  lastAutoSave,
  onDelete,
  onPreview,
  onSubmit,
}: EditorHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
      <div className="flex items-center gap-2 md:gap-4">
        <Link
          to={isEditing && postSlug ? `/posts/${postSlug}` : '/admin/drafts'}
          className="p-1.5 md:p-2 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[20px] md:text-[24px]">arrow_back</span>
        </Link>
        <h1 className="text-lg md:text-2xl font-bold">
          {isEditing ? '게시물 수정' : '새 글 작성'}
        </h1>
      </div>
      <div className="flex items-center gap-2 md:gap-3 flex-wrap">
        {/* Auto-save status indicator */}
        {(isAutoSaving || lastAutoSave) && (
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
            {isAutoSaving ? (
              <>
                <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                <span>자동 저장 중...</span>
              </>
            ) : lastAutoSave ? (
              <>
                <span className="material-symbols-outlined text-[14px] text-green-500">
                  check_circle
                </span>
                <span>
                  자동 저장됨{' '}
                  {lastAutoSave.toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </>
            ) : null}
          </div>
        )}
        {isEditing && (
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs md:text-sm font-medium transition-colors flex items-center gap-1 md:gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px] md:text-[18px]">
              {isDeleting ? 'progress_activity' : 'delete'}
            </span>
            <span className="hidden md:inline">{isDeleting ? '삭제 중...' : '삭제'}</span>
          </button>
        )}
        <button
          onClick={onPreview}
          className="px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs md:text-sm font-medium transition-colors flex items-center gap-1 md:gap-2"
        >
          <span className="material-symbols-outlined text-[16px] md:text-[18px]">visibility</span>
          <span className="hidden md:inline">미리보기</span>
        </button>
        <button
          onClick={onSubmit}
          disabled={isSaving}
          className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs md:text-sm font-bold transition-colors flex items-center gap-1 md:gap-2 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <span className="material-symbols-outlined animate-spin text-[16px] md:text-[18px]">
                progress_activity
              </span>
              <span className="hidden md:inline">저장 중...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[16px] md:text-[18px]">edit</span>
              수정하기
              {isDirty && !isAutoSaving && (
                <span
                  className="w-2 h-2 rounded-full bg-orange-500 ml-1"
                  title="저장하지 않은 변경사항"
                />
              )}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default memo(EditorHeader)
