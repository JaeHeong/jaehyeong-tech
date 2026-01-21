import { useState, useEffect } from 'react'
import { api, type BackupInfo, type BackupInfoDetail } from '../services/api'
import { useModal } from '../contexts/ModalContext'

interface OrphanImage {
  id: string
  url: string
  objectName: string
  filename: string
  size: number
  createdAt: string
}

interface ImageStats {
  total: number
  linked: number
  usedInDrafts: number
  orphaned: number
  totalSize: number
  externalCount?: number
  externalUrls?: string[]
}

export default function AdminManagementPage() {
  const { confirm } = useModal()
  // Backup state
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [isLoadingBackups, setIsLoadingBackups] = useState(false)
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [isRestoringBackup, setIsRestoringBackup] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Preview modal state
  const [previewBackup, setPreviewBackup] = useState<BackupInfoDetail | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Backup create modal state
  const [showBackupModal, setShowBackupModal] = useState(false)
  const [backupDescription, setBackupDescription] = useState('')

  // Image cleanup state
  const [orphanImages, setOrphanImages] = useState<OrphanImage[]>([])
  const [imageStats, setImageStats] = useState<ImageStats | null>(null)
  const [isLoadingImages, setIsLoadingImages] = useState(false)
  const [isDeletingOrphans, setIsDeletingOrphans] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [imageMessage, setImageMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Backup functions
  const fetchBackups = async () => {
    setIsLoadingBackups(true)
    try {
      const data = await api.listBackups()
      setBackups(data)
    } catch {
      setBackupMessage({ type: 'error', text: '백업 목록을 불러오는데 실패했습니다.' })
    } finally {
      setIsLoadingBackups(false)
    }
  }

  // Auto-load backups on mount
  useEffect(() => {
    fetchBackups()
  }, [])

  // ESC/Enter key handler for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewBackup) {
          setPreviewBackup(null)
        }
        if (showBackupModal && !isCreatingBackup) {
          setShowBackupModal(false)
          setBackupDescription('')
        }
      } else if (e.key === 'Enter' && showBackupModal && !isCreatingBackup) {
        // Skip if typing in textarea (allow Shift+Enter for newlines)
        const target = e.target as HTMLElement
        if (target.tagName === 'TEXTAREA') {
          if (!e.shiftKey) {
            // Enter without Shift: submit backup
            e.preventDefault()
            handleCreateBackup()
          }
          // Shift+Enter: allow default (newline)
          return
        }
        e.preventDefault()
        handleCreateBackup()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [previewBackup, showBackupModal, isCreatingBackup, backupDescription])

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true)
    setBackupMessage(null)
    try {
      const result = await api.createBackup(backupDescription.trim() || undefined)
      setBackupMessage({
        type: 'success',
        text: `백업이 생성되었습니다. (게시물: ${result.data.stats.posts}, 댓글: ${result.data.stats.comments}, 북마크: ${result.data.stats.bookmarks}, 좋아요: ${result.data.stats.likes}, 이미지: ${result.data.stats.images}, 버그리포트: ${result.data.stats.bugReports}, 방문자: ${result.data.stats.siteVisitors || 0})`,
      })
      setShowBackupModal(false)
      setBackupDescription('')
      fetchBackups()
    } catch {
      setBackupMessage({ type: 'error', text: '백업 생성에 실패했습니다.' })
    } finally {
      setIsCreatingBackup(false)
    }
  }

  const handleDownloadBackup = async (fileName: string) => {
    try {
      await api.downloadBackup(fileName)
    } catch {
      setBackupMessage({ type: 'error', text: '백업 다운로드에 실패했습니다.' })
    }
  }

  const handleRestoreBackup = async (fileName: string) => {
    const confirmed = await confirm({
      title: '백업 복원',
      message: '정말 이 백업으로 복원하시겠습니까?\n현재 데이터가 모두 삭제됩니다.',
      confirmText: '복원',
      cancelText: '취소',
      type: 'danger',
    })
    if (!confirmed) return

    setIsRestoringBackup(fileName)
    setBackupMessage(null)
    try {
      const result = await api.restoreBackup(fileName)
      // MSA response format: results.{service}.{entity}.restored
      const r = result.data.results
      const posts = r?.blog?.posts?.restored ?? 0
      const drafts = r?.blog?.drafts?.restored ?? 0
      const comments = r?.comment?.comments?.restored ?? 0
      const pages = r?.page?.pages?.restored ?? 0
      const users = r?.auth?.users?.restored ?? 0
      const visitors = r?.analytics?.siteVisitors?.restored ?? 0
      setBackupMessage({
        type: 'success',
        text: `백업이 복원되었습니다. (게시물: ${posts}, 임시저장: ${drafts}, 댓글: ${comments}, 페이지: ${pages}, 사용자: ${users}, 방문자: ${visitors})`,
      })
    } catch {
      setBackupMessage({ type: 'error', text: '백업 복원에 실패했습니다.' })
    } finally {
      setIsRestoringBackup(null)
    }
  }

  const handleDeleteBackup = async (fileName: string) => {
    const confirmed = await confirm({
      title: '백업 삭제',
      message: '이 백업을 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger',
    })
    if (!confirmed) return

    try {
      await api.deleteBackup(fileName)
      setBackupMessage({ type: 'success', text: '백업이 삭제되었습니다.' })
      fetchBackups()
    } catch {
      setBackupMessage({ type: 'error', text: '백업 삭제에 실패했습니다.' })
    }
  }

  const handlePreviewBackup = async (fileName: string) => {
    setIsLoadingPreview(true)
    try {
      const result = await api.getBackupInfo(fileName)
      setPreviewBackup(result.data)
    } catch {
      setBackupMessage({ type: 'error', text: '백업 정보를 불러오는데 실패했습니다.' })
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // Image cleanup functions
  const fetchOrphanImages = async () => {
    setIsLoadingImages(true)
    setImageMessage(null)
    try {
      const response = await api.getOrphanImages()
      setOrphanImages(response.orphans)
      setImageStats(response.stats)
    } catch {
      setImageMessage({ type: 'error', text: '이미지 정보를 불러오는데 실패했습니다.' })
    } finally {
      setIsLoadingImages(false)
    }
  }

  const handleSyncImages = async () => {
    setIsSyncing(true)
    setImageMessage(null)
    try {
      const result = await api.syncImages()
      if (result.removed > 0) {
        setImageMessage({
          type: 'success',
          text: `동기화 완료: ${result.checked}개 확인, ${result.removed}개 DB 레코드 정리 (${formatBytes(result.freedSpace)})`,
        })
        // Refresh orphan images after sync
        fetchOrphanImages()
      } else {
        setImageMessage({
          type: 'success',
          text: `동기화 완료: ${result.checked}개 확인, 모든 레코드가 버킷과 일치합니다.`,
        })
      }
    } catch {
      setImageMessage({ type: 'error', text: 'DB 동기화에 실패했습니다.' })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDeleteOrphans = async () => {
    if (orphanImages.length === 0) return

    const confirmed = await confirm({
      title: '고아 이미지 삭제',
      message: `${orphanImages.length}개의 고아 이미지를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger',
    })
    if (!confirmed) return

    setIsDeletingOrphans(true)
    setImageMessage(null)
    try {
      const result = await api.deleteOrphanImages()
      setImageMessage({
        type: 'success',
        text: `${result.deleted}개의 고아 이미지가 삭제되었습니다. (${formatBytes(result.freedSpace)} 확보)`,
      })
      fetchOrphanImages()
    } catch {
      setImageMessage({ type: 'error', text: '이미지 삭제에 실패했습니다.' })
    } finally {
      setIsDeletingOrphans(false)
    }
  }

  const formatBackupDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col gap-4 md:gap-8">
        {/* Header */}
        <div className="flex flex-col gap-1 md:gap-2 pb-3 md:pb-4 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-xl md:text-3xl font-bold tracking-tight">시스템 관리</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-lg">
            데이터 백업 및 스토리지 관리
          </p>
        </div>

        {/* Data Backup Section */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0 mb-4 md:mb-6">
            <div>
              <h2 className="text-base md:text-xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px] md:text-[24px]">backup</span>
                데이터 백업
              </h2>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5 md:mt-1">
                게시물, 임시저장, 카테고리, 태그, 페이지 데이터를 백업하고 복원합니다.
              </p>
            </div>
            <button
              onClick={() => setShowBackupModal(true)}
              className="px-3 md:px-4 py-1.5 md:py-2 bg-primary hover:bg-primary/90 text-white text-xs md:text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 md:gap-2"
            >
              <span className="material-symbols-outlined text-[16px] md:text-[18px]">cloud_upload</span>
              새 백업
            </button>
          </div>

          {/* Backup Message */}
          {backupMessage && (
            <div
              className={`p-3 md:p-4 rounded-lg mb-3 md:mb-4 ${
                backupMessage.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex items-center gap-2 text-xs md:text-sm">
                <span className="material-symbols-outlined text-[18px] md:text-[20px]">
                  {backupMessage.type === 'success' ? 'check_circle' : 'error'}
                </span>
                {backupMessage.text}
              </div>
            </div>
          )}

          {/* Backup List */}
          <div className="space-y-2 md:space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300">백업 목록</h3>
              <button
                onClick={fetchBackups}
                disabled={isLoadingBackups}
                className="text-xs md:text-sm text-primary hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px] md:text-[16px]">refresh</span>
                새로고침
              </button>
            </div>

            {isLoadingBackups ? (
              <div className="flex items-center justify-center py-6 md:py-8">
                <span className="material-symbols-outlined animate-spin text-xl md:text-2xl text-primary">progress_activity</span>
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-6 md:py-8 text-slate-500 dark:text-slate-400">
                <span className="material-symbols-outlined text-[36px] md:text-[48px] mb-2 block opacity-50">cloud_off</span>
                <p className="text-xs md:text-sm">백업이 없습니다.</p>
                <button onClick={fetchBackups} className="mt-2 text-primary text-xs md:text-sm hover:underline">
                  목록 불러오기
                </button>
              </div>
            ) : (
              <>
                {/* Mobile: Card List */}
                <div className="md:hidden space-y-2">
                  {backups.map((backup) => (
                    <div key={backup.fullPath} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate">{backup.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{formatBackupDate(backup.createdAt)}</p>
                          {backup.description && (
                            <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{backup.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => backup.name && handlePreviewBackup(backup.name)}
                            disabled={isLoadingPreview}
                            className="p-1 text-slate-400 hover:text-primary transition-colors rounded disabled:opacity-50"
                            title="미리보기"
                          >
                            <span className="material-symbols-outlined text-[16px]">info</span>
                          </button>
                          <button
                            onClick={() => backup.name && handleDownloadBackup(backup.name)}
                            className="p-1 text-slate-400 hover:text-blue-500 transition-colors rounded"
                            title="다운로드"
                          >
                            <span className="material-symbols-outlined text-[16px]">download</span>
                          </button>
                          <button
                            onClick={() => backup.name && handleRestoreBackup(backup.name)}
                            disabled={isRestoringBackup === backup.name}
                            className="p-1 text-slate-400 hover:text-green-500 transition-colors rounded disabled:opacity-50"
                            title="복원"
                          >
                            <span className={`material-symbols-outlined text-[16px] ${isRestoringBackup === backup.name ? 'animate-spin' : ''}`}>
                              {isRestoringBackup === backup.name ? 'progress_activity' : 'restore'}
                            </span>
                          </button>
                          <button
                            onClick={() => backup.name && handleDeleteBackup(backup.name)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors rounded"
                            title="삭제"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">파일명</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">설명</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">생성일시</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {backups.map((backup) => (
                        <tr key={backup.fullPath} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-mono text-xs">{backup.name}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={backup.description || undefined}>
                            {backup.description || <span className="text-slate-400">-</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                            {formatBackupDate(backup.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => backup.name && handlePreviewBackup(backup.name)}
                                disabled={isLoadingPreview}
                                className="p-1.5 text-slate-400 hover:text-primary transition-colors rounded disabled:opacity-50"
                                title="미리보기"
                              >
                                <span className="material-symbols-outlined text-[18px]">info</span>
                              </button>
                              <button
                                onClick={() => backup.name && handleDownloadBackup(backup.name)}
                                className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors rounded"
                                title="다운로드"
                              >
                                <span className="material-symbols-outlined text-[18px]">download</span>
                              </button>
                              <button
                                onClick={() => backup.name && handleRestoreBackup(backup.name)}
                                disabled={isRestoringBackup === backup.name}
                                className="p-1.5 text-slate-400 hover:text-green-500 transition-colors rounded disabled:opacity-50"
                                title="복원"
                              >
                                <span className={`material-symbols-outlined text-[18px] ${isRestoringBackup === backup.name ? 'animate-spin' : ''}`}>
                                  {isRestoringBackup === backup.name ? 'progress_activity' : 'restore'}
                                </span>
                              </button>
                              <button
                                onClick={() => backup.name && handleDeleteBackup(backup.name)}
                                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded"
                                title="삭제"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Image Cleanup Section */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0 mb-4 md:mb-6">
            <div>
              <h2 className="text-base md:text-xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px] md:text-[24px]">auto_delete</span>
                이미지 정리
              </h2>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5 md:mt-1">
                어떤 게시물에도 연결되지 않은 고아 이미지를 정리합니다.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSyncImages}
                disabled={isSyncing || isLoadingImages}
                className="px-3 md:px-4 py-1.5 md:py-2 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs md:text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 md:gap-2"
                title="버킷에서 삭제된 파일의 DB 레코드를 정리합니다"
              >
                {isSyncing ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px] md:text-[18px]">progress_activity</span>
                    동기화 중...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">sync</span>
                    DB 동기화
                  </>
                )}
              </button>
              <button
                onClick={fetchOrphanImages}
                disabled={isLoadingImages || isSyncing}
                className="px-3 md:px-4 py-1.5 md:py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs md:text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 md:gap-2"
              >
                {isLoadingImages ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px] md:text-[18px]">progress_activity</span>
                    분석 중...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">search</span>
                    고아 이미지 검색
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Image Message */}
          {imageMessage && (
            <div
              className={`p-3 md:p-4 rounded-lg mb-3 md:mb-4 ${
                imageMessage.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex items-center gap-2 text-xs md:text-sm">
                <span className="material-symbols-outlined text-[18px] md:text-[20px]">
                  {imageMessage.type === 'success' ? 'check_circle' : 'error'}
                </span>
                {imageMessage.text}
              </div>
            </div>
          )}

          {/* Image Stats */}
          {imageStats && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-4 mb-4 md:mb-6">
              <div className="p-3 md:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">전체 이미지</p>
                <p className="text-lg md:text-2xl font-bold">{imageStats.total}</p>
              </div>
              <div className="p-3 md:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-[10px] md:text-sm text-green-600 dark:text-green-400">게시글 연결</p>
                <p className="text-lg md:text-2xl font-bold text-green-600 dark:text-green-400">{imageStats.linked}</p>
              </div>
              <div className="p-3 md:p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-[10px] md:text-sm text-amber-600 dark:text-amber-400">임시저장 사용</p>
                <p className="text-lg md:text-2xl font-bold text-amber-600 dark:text-amber-400">{imageStats.usedInDrafts}</p>
              </div>
              <div className="p-3 md:p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-[10px] md:text-sm text-red-600 dark:text-red-400">고아 이미지</p>
                <p className="text-lg md:text-2xl font-bold text-red-600 dark:text-red-400">{imageStats.orphaned}</p>
              </div>
              <div className="p-3 md:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg" title={imageStats.externalUrls?.join('\n')}>
                <p className="text-[10px] md:text-sm text-blue-600 dark:text-blue-400">외부 링크</p>
                <p className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-400">{imageStats.externalCount || 0}</p>
              </div>
              <div className="p-3 md:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">총 용량</p>
                <p className="text-lg md:text-2xl font-bold">{formatBytes(imageStats.totalSize)}</p>
              </div>
            </div>
          )}

          {/* Orphan Images List */}
          {orphanImages.length > 0 && (
            <div className="space-y-3 md:space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300">
                  고아 이미지 목록 ({orphanImages.length}개)
                </h3>
                <button
                  onClick={handleDeleteOrphans}
                  disabled={isDeletingOrphans}
                  className="px-3 md:px-4 py-1.5 md:py-2 bg-red-500 hover:bg-red-600 text-white text-xs md:text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 md:gap-2"
                >
                  {isDeletingOrphans ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[16px] md:text-[18px]">progress_activity</span>
                      삭제 중...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px] md:text-[18px]">delete_forever</span>
                      모두 삭제
                    </>
                  )}
                </button>
              </div>

              {/* Mobile: Card List */}
              <div className="md:hidden border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {orphanImages.map((image) => (
                    <div key={image.id} className="flex items-center gap-3 p-2">
                      <img
                        src={image.url}
                        alt={image.filename}
                        className="w-10 h-10 object-cover rounded shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate">{image.filename}</p>
                        <p className="text-[10px] text-slate-500">{formatBytes(image.size)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop: Table */}
              <div className="hidden md:block border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">미리보기</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">파일명</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">크기</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">업로드일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {orphanImages.map((image) => (
                      <tr key={image.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2">
                          <img
                            src={image.url}
                            alt={image.filename}
                            className="w-12 h-12 object-cover rounded"
                          />
                        </td>
                        <td className="px-4 py-2 font-mono text-xs truncate max-w-[200px]">{image.filename}</td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{formatBytes(image.size)}</td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                          {formatBackupDate(image.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!imageStats && !isLoadingImages && (
            <div className="text-center py-6 md:py-8 text-slate-500 dark:text-slate-400">
              <span className="material-symbols-outlined text-[36px] md:text-[48px] mb-2 block opacity-50">image_search</span>
              <p className="text-xs md:text-sm">"고아 이미지 검색" 버튼을 눌러 분석을 시작하세요.</p>
            </div>
          )}
        </div>
      </div>

      {/* Backup Preview Modal */}
      {previewBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setPreviewBackup(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">backup</span>
                백업 정보
              </h3>
              <button
                onClick={() => setPreviewBackup(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">파일명</span>
                <span className="font-mono text-xs">{previewBackup.fileName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">버전</span>
                <span>{previewBackup.version}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">생성일시</span>
                <span>{formatBackupDate(previewBackup.createdAt)}</span>
              </div>
              {previewBackup.description && (
                <div className="text-sm">
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">설명</span>
                  <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-xs">
                    {previewBackup.description}
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <h4 className="text-sm font-medium mb-3">저장된 데이터</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                  <p className="text-xl font-bold">{previewBackup.stats.posts}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">게시물</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                  <p className="text-xl font-bold">{previewBackup.stats.drafts}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">임시저장</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                  <p className="text-xl font-bold">{previewBackup.stats.comments}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">댓글</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                  <p className="text-xl font-bold">{previewBackup.stats.bookmarks}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">북마크</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                  <p className="text-xl font-bold">{previewBackup.stats.likes}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">좋아요</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                  <p className="text-xl font-bold">{previewBackup.stats.images}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">이미지</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                  <p className="text-xl font-bold">{previewBackup.stats.pages}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">페이지</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                  <p className="text-xl font-bold">{previewBackup.stats.categories}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">카테고리</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                  <p className="text-xl font-bold">{previewBackup.stats.tags}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">태그</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                  <p className="text-xl font-bold">{previewBackup.stats.users}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">사용자</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                  <p className="text-xl font-bold">{previewBackup.stats.bugReports || 0}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">버그리포트</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                  <p className="text-xl font-bold">{previewBackup.stats.siteVisitors || 0}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">방문자 기록</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setPreviewBackup(null)}
              className="w-full mt-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Backup Create Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !isCreatingBackup && setShowBackupModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">cloud_upload</span>
                새 백업 생성
              </h3>
              <button
                onClick={() => !isCreatingBackup && setShowBackupModal(false)}
                disabled={isCreatingBackup}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                백업 설명 <span className="text-slate-400 font-normal">(선택)</span>
              </label>
              <textarea
                value={backupDescription}
                onChange={(e) => setBackupDescription(e.target.value)}
                placeholder="예: v2.0 배포 전 백업, 마이그레이션 전 백업"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                rows={3}
                disabled={isCreatingBackup}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                나중에 백업을 구분하기 위한 메모를 남겨두세요.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowBackupModal(false)
                  setBackupDescription('')
                }}
                disabled={isCreatingBackup}
                className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleCreateBackup}
                disabled={isCreatingBackup}
                className="flex-1 py-2 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCreatingBackup ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    백업 중...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">backup</span>
                    백업 생성
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
