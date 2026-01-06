import { useState } from 'react'

interface Comment {
  id: string
  author: string
  email: string
  content: string
  postTitle: string
  postSlug: string
  status: 'pending' | 'approved' | 'spam'
  createdAt: string
}

// Mock data - will be replaced with API
const mockComments: Comment[] = [
  {
    id: '1',
    author: 'John Doe',
    email: 'john@example.com',
    content: 'Terraform 상태 관리 글 정말 도움이 많이 되었습니다. 혹시 S3 백엔드 설정 관련해서 더 자세한 내용을 다뤄주실 수 있나요?',
    postTitle: 'Terraform 상태 관리 Best Practice',
    postSlug: 'terraform-state-management',
    status: 'pending',
    createdAt: '2024-01-06T12:00:00Z',
  },
  {
    id: '2',
    author: 'Alice Lee',
    email: 'alice@example.com',
    content: 'MLOps 파이프라인 구축 글 기대됩니다! 작성 완료되면 알림 받고 싶네요.',
    postTitle: 'MLOps 파이프라인 구축을 위한 오픈소스 도구 비교',
    postSlug: 'mlops-pipeline-tools',
    status: 'approved',
    createdAt: '2024-01-05T10:00:00Z',
  },
  {
    id: '3',
    author: 'Minsoo Kim',
    email: 'minsoo@example.com',
    content: 'Docker Compose V2 관련해서 호환성 문제가 조금 있던데 이 부분도 다뤄주실 수 있나요?',
    postTitle: 'Docker Compose V2 마이그레이션 가이드',
    postSlug: 'docker-compose-v2-migration',
    status: 'approved',
    createdAt: '2024-01-04T08:00:00Z',
  },
  {
    id: '4',
    author: 'Spammer',
    email: 'spam@spam.com',
    content: 'Click here to win $1000!!!',
    postTitle: 'Kubernetes 서비스 메쉬 Istio 도입기',
    postSlug: 'kubernetes-istio-introduction',
    status: 'spam',
    createdAt: '2024-01-03T06:00:00Z',
  },
]

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>(mockComments)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'spam'>('all')
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; comment: Comment | null }>({
    isOpen: false,
    comment: null,
  })

  const filteredComments = filter === 'all'
    ? comments
    : comments.filter((c) => c.status === filter)

  const handleStatusChange = (commentId: string, newStatus: Comment['status']) => {
    setComments(
      comments.map((c) =>
        c.id === commentId ? { ...c, status: newStatus } : c
      )
    )
  }

  const handleDelete = () => {
    if (!deleteModal.comment) return
    setComments(comments.filter((c) => c.id !== deleteModal.comment?.id))
    setDeleteModal({ isOpen: false, comment: null })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`
    return date.toLocaleDateString('ko-KR')
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const statusCounts = {
    all: comments.length,
    pending: comments.filter((c) => c.status === 'pending').length,
    approved: comments.filter((c) => c.status === 'approved').length,
    spam: comments.filter((c) => c.status === 'spam').length,
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold">댓글 관리</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            블로그 댓글을 관리합니다.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: '전체', icon: 'chat' },
          { key: 'pending', label: '대기중', icon: 'pending' },
          { key: 'approved', label: '승인됨', icon: 'check_circle' },
          { key: 'spam', label: '스팸', icon: 'report' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              filter === tab.key
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              filter === tab.key
                ? 'bg-white/20'
                : 'bg-slate-200 dark:bg-slate-700'
            }`}>
              {statusCounts[tab.key as keyof typeof statusCounts]}
            </span>
          </button>
        ))}
      </div>

      {/* Comments List */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {filteredComments.length > 0 ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredComments.map((comment) => (
              <div
                key={comment.id}
                className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className="shrink-0">
                    <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {getInitials(comment.author)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {comment.author}
                      </span>
                      <span className="text-xs text-slate-500">{comment.email}</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500">{formatDate(comment.createdAt)}</span>
                      {comment.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                          대기중
                        </span>
                      )}
                      {comment.status === 'spam' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                          스팸
                        </span>
                      )}
                    </div>

                    <p className="text-slate-600 dark:text-slate-300 mb-3 text-sm leading-relaxed">
                      {comment.content}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <a
                        href={`/posts/${comment.postSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">article</span>
                        {comment.postTitle}
                      </a>

                      <div className="flex gap-2">
                        {comment.status !== 'approved' && (
                          <button
                            onClick={() => handleStatusChange(comment.id, 'approved')}
                            className="px-3 py-1 text-xs font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                          >
                            승인
                          </button>
                        )}
                        {comment.status !== 'spam' && (
                          <button
                            onClick={() => handleStatusChange(comment.id, 'spam')}
                            className="px-3 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                          >
                            스팸
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteModal({ isOpen: true, comment })}
                          className="px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500">
            <span className="material-symbols-outlined text-[48px] mb-4 block">chat</span>
            <p>댓글이 없습니다.</p>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteModal({ isOpen: false, comment: null })}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <h3 className="text-lg font-bold">댓글 삭제</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              <strong className="text-slate-900 dark:text-white">{deleteModal.comment?.author}</strong>
              님의 댓글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteModal({ isOpen: false, comment: null })}
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
