import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import PostListPage from './pages/PostListPage'
import PostDetailPage from './pages/PostDetailPage'
import IntroducePage from './pages/IntroducePage'
import CategoryPage from './pages/CategoryPage'
import SearchPage from './pages/SearchPage'
import NoticePage from './pages/NoticePage'
import NoticeDetailPage from './pages/NoticeDetailPage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminPostEditorPage from './pages/AdminPostEditorPage'
import AdminDraftEditorPage from './pages/AdminDraftEditorPage'
import AdminSettingsPage from './pages/AdminSettingsPage'
import AdminPostsPage from './pages/AdminPostsPage'
import AdminCategoriesPage from './pages/AdminCategoriesPage'
import AdminTagsPage from './pages/AdminTagsPage'
import AdminCommentsPage from './pages/AdminCommentsPage'
import AdminDraftsPage from './pages/AdminDraftsPage'
import AdminPagesPage from './pages/AdminPagesPage'
import AdminPageEditorPage from './pages/AdminPageEditorPage'
import AdminManagementPage from './pages/AdminManagementPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
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
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin/login',
    element: <AdminLoginPage />,
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
      { path: 'posts', element: <AdminPostsPage /> },
      { path: 'posts/new', element: <AdminDraftEditorPage /> },
      { path: 'posts/:id/edit', element: <AdminPostEditorPage /> },
      { path: 'categories', element: <AdminCategoriesPage /> },
      { path: 'tags', element: <AdminTagsPage /> },
      { path: 'drafts', element: <AdminDraftsPage /> },
      { path: 'drafts/:id/edit', element: <AdminDraftEditorPage /> },
      { path: 'comments', element: <AdminCommentsPage /> },
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
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
