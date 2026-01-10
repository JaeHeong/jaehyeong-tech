import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ModalProvider } from './contexts/ModalContext'
import { ToastProvider } from './contexts/ToastContext'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import UserProtectedRoute from './components/UserProtectedRoute'
import HomePage from './pages/HomePage'
import PostListPage from './pages/PostListPage'
import PostDetailPage from './pages/PostDetailPage'
import IntroducePage from './pages/IntroducePage'
import CategoryPage from './pages/CategoryPage'
import SearchPage from './pages/SearchPage'
import NoticePage from './pages/NoticePage'
import NoticeDetailPage from './pages/NoticeDetailPage'
import LoginPage from './pages/LoginPage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminPostEditorPage from './pages/AdminPostEditorPage'
import AdminDraftEditorPage from './pages/AdminDraftEditorPage'
import AdminSettingsPage from './pages/AdminSettingsPage'
import AdminPostsPage from './pages/AdminPostsPage'
import AdminCategoriesPage from './pages/AdminCategoriesPage'
import AdminTagsPage from './pages/AdminTagsPage'
import AdminCommentsPage from './pages/AdminCommentsPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminDraftsPage from './pages/AdminDraftsPage'
import AdminPagesPage from './pages/AdminPagesPage'
import AdminPageEditorPage from './pages/AdminPageEditorPage'
import AdminManagementPage from './pages/AdminManagementPage'
import AdminAnalyticsPage from './pages/AdminAnalyticsPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import MyCommentsPage from './pages/MyCommentsPage'
import MyBookmarksPage from './pages/MyBookmarksPage'
import MySettingsPage from './pages/MySettingsPage'
import SuspendedPage from './pages/SuspendedPage'
import BugReportPage from './pages/BugReportPage'
import BugReportListPage from './pages/BugReportListPage'
import BugReportDetailPage from './pages/BugReportDetailPage'
import NotFoundPage from './pages/NotFoundPage'
import './styles/index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'posts', element: <PostListPage /> },
      { path: 'posts/:slug', element: <PostDetailPage /> },
      { path: 'introduce', element: <IntroducePage /> },
      { path: 'categories', element: <CategoryPage /> },
      { path: 'categories/:slug', element: <PostListPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'notices', element: <NoticePage /> },
      { path: 'notices/:slug', element: <NoticeDetailPage /> },
      { path: 'privacy', element: <PrivacyPolicyPage /> },
      { path: 'bug-report', element: <BugReportPage /> },
      { path: 'bug-reports', element: <BugReportListPage /> },
      { path: 'bug-reports/:id', element: <BugReportDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
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
            <MyBookmarksPage />
          </UserProtectedRoute>
        ),
      },
      {
        path: 'comments',
        element: (
          <UserProtectedRoute>
            <MyCommentsPage />
          </UserProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <UserProtectedRoute>
            <MySettingsPage />
          </UserProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/admin/login',
    element: <AdminLoginPage />,
  },
  {
    path: '/suspended',
    element: <SuspendedPage />,
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute requireAdmin>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'analytics', element: <AdminAnalyticsPage /> },
      { path: 'posts', element: <AdminPostsPage /> },
      { path: 'posts/new', element: <AdminDraftEditorPage /> },
      { path: 'posts/:id/edit', element: <AdminPostEditorPage /> },
      { path: 'categories', element: <AdminCategoriesPage /> },
      { path: 'tags', element: <AdminTagsPage /> },
      { path: 'drafts', element: <AdminDraftsPage /> },
      { path: 'drafts/:id/edit', element: <AdminDraftEditorPage /> },
      { path: 'comments', element: <AdminCommentsPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'pages', element: <AdminPagesPage /> },
      { path: 'pages/:id/edit', element: <AdminPageEditorPage /> },
      { path: 'management', element: <AdminManagementPage /> },
      { path: 'settings', element: <AdminSettingsPage /> },
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
