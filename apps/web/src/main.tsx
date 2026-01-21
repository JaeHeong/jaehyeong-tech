import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ModalProvider } from './contexts/ModalContext'
import { ToastProvider } from './contexts/ToastContext'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import UserProtectedRoute from './components/UserProtectedRoute'
import './styles/index.css'

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3182f6]"></div>
  </div>
)

// Lazy load pages for code splitting
const HomePage = lazy(() => import('./pages/HomePage'))
const PostListPage = lazy(() => import('./pages/PostListPage'))
const PostDetailPage = lazy(() => import('./pages/PostDetailPage'))
const IntroducePage = lazy(() => import('./pages/IntroducePage'))
const CategoryPage = lazy(() => import('./pages/CategoryPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const NoticePage = lazy(() => import('./pages/NoticePage'))
const NoticeDetailPage = lazy(() => import('./pages/NoticeDetailPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const MyCommentsPage = lazy(() => import('./pages/MyCommentsPage'))
const MyBookmarksPage = lazy(() => import('./pages/MyBookmarksPage'))
const MySettingsPage = lazy(() => import('./pages/MySettingsPage'))
const SuspendedPage = lazy(() => import('./pages/SuspendedPage'))
const BugReportPage = lazy(() => import('./pages/BugReportPage'))
const BugReportListPage = lazy(() => import('./pages/BugReportListPage'))
const BugReportDetailPage = lazy(() => import('./pages/BugReportDetailPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

// Admin pages - lazy loaded
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'))
const AdminPostEditorPage = lazy(() => import('./pages/AdminPostEditorPage'))
const AdminDraftEditorPage = lazy(() => import('./pages/AdminDraftEditorPage'))
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage'))
const AdminPostsPage = lazy(() => import('./pages/AdminPostsPage'))
const AdminCategoriesPage = lazy(() => import('./pages/AdminCategoriesPage'))
const AdminTagsPage = lazy(() => import('./pages/AdminTagsPage'))
const AdminCommentsPage = lazy(() => import('./pages/AdminCommentsPage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))
const AdminDraftsPage = lazy(() => import('./pages/AdminDraftsPage'))
const AdminPagesPage = lazy(() => import('./pages/AdminPagesPage'))
const AdminPageEditorPage = lazy(() => import('./pages/AdminPageEditorPage'))
const AdminManagementPage = lazy(() => import('./pages/AdminManagementPage'))
const AdminAnalyticsPage = lazy(() => import('./pages/AdminAnalyticsPage'))

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Suspense fallback={<PageLoader />}><HomePage /></Suspense> },
      { path: 'posts', element: <Suspense fallback={<PageLoader />}><PostListPage /></Suspense> },
      { path: 'posts/:slug', element: <Suspense fallback={<PageLoader />}><PostDetailPage /></Suspense> },
      { path: 'introduce', element: <Suspense fallback={<PageLoader />}><IntroducePage /></Suspense> },
      { path: 'categories', element: <Suspense fallback={<PageLoader />}><CategoryPage /></Suspense> },
      { path: 'categories/:slug', element: <Suspense fallback={<PageLoader />}><PostListPage /></Suspense> },
      { path: 'search', element: <Suspense fallback={<PageLoader />}><SearchPage /></Suspense> },
      { path: 'notices', element: <Suspense fallback={<PageLoader />}><NoticePage /></Suspense> },
      { path: 'notices/:slug', element: <Suspense fallback={<PageLoader />}><NoticeDetailPage /></Suspense> },
      { path: 'privacy', element: <Suspense fallback={<PageLoader />}><PrivacyPolicyPage /></Suspense> },
      { path: 'bug-report', element: <Suspense fallback={<PageLoader />}><BugReportPage /></Suspense> },
      { path: 'bug-reports', element: <Suspense fallback={<PageLoader />}><BugReportListPage /></Suspense> },
      { path: 'bug-reports/:id', element: <Suspense fallback={<PageLoader />}><BugReportDetailPage /></Suspense> },
      { path: '*', element: <Suspense fallback={<PageLoader />}><NotFoundPage /></Suspense> },
    ],
  },
  {
    path: '/my',
    element: <Layout />,
    children: [
      {
        path: 'bookmarks',
        element: (
          <UserProtectedRoute>
            <Suspense fallback={<PageLoader />}><MyBookmarksPage /></Suspense>
          </UserProtectedRoute>
        ),
      },
      {
        path: 'comments',
        element: (
          <UserProtectedRoute>
            <Suspense fallback={<PageLoader />}><MyCommentsPage /></Suspense>
          </UserProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <UserProtectedRoute>
            <Suspense fallback={<PageLoader />}><MySettingsPage /></Suspense>
          </UserProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '/login',
    element: <Suspense fallback={<PageLoader />}><LoginPage /></Suspense>,
  },
  {
    path: '/admin/login',
    element: <Suspense fallback={<PageLoader />}><AdminLoginPage /></Suspense>,
  },
  {
    path: '/suspended',
    element: <Suspense fallback={<PageLoader />}><SuspendedPage /></Suspense>,
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute requireAdmin>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Suspense fallback={<PageLoader />}><AdminDashboardPage /></Suspense> },
      { path: 'analytics', element: <Suspense fallback={<PageLoader />}><AdminAnalyticsPage /></Suspense> },
      { path: 'posts', element: <Suspense fallback={<PageLoader />}><AdminPostsPage /></Suspense> },
      { path: 'posts/new', element: <Suspense fallback={<PageLoader />}><AdminDraftEditorPage /></Suspense> },
      { path: 'posts/:id/edit', element: <Suspense fallback={<PageLoader />}><AdminPostEditorPage /></Suspense> },
      { path: 'categories', element: <Suspense fallback={<PageLoader />}><AdminCategoriesPage /></Suspense> },
      { path: 'tags', element: <Suspense fallback={<PageLoader />}><AdminTagsPage /></Suspense> },
      { path: 'drafts', element: <Suspense fallback={<PageLoader />}><AdminDraftsPage /></Suspense> },
      { path: 'drafts/:id/edit', element: <Suspense fallback={<PageLoader />}><AdminDraftEditorPage /></Suspense> },
      { path: 'comments', element: <Suspense fallback={<PageLoader />}><AdminCommentsPage /></Suspense> },
      { path: 'users', element: <Suspense fallback={<PageLoader />}><AdminUsersPage /></Suspense> },
      { path: 'pages', element: <Suspense fallback={<PageLoader />}><AdminPagesPage /></Suspense> },
      { path: 'pages/:id/edit', element: <Suspense fallback={<PageLoader />}><AdminPageEditorPage /></Suspense> },
      { path: 'management', element: <Suspense fallback={<PageLoader />}><AdminManagementPage /></Suspense> },
      { path: 'settings', element: <Suspense fallback={<PageLoader />}><AdminSettingsPage /></Suspense> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ModalProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ModalProvider>
    </AuthProvider>
  </StrictMode>,
)
