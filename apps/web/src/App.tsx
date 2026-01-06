import { Routes, Route } from 'react-router-dom'
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
import AdminSettingsPage from './pages/AdminSettingsPage'
import AdminPostsPage from './pages/AdminPostsPage'
import AdminCategoriesPage from './pages/AdminCategoriesPage'
import AdminCommentsPage from './pages/AdminCommentsPage'
import AdminDraftsPage from './pages/AdminDraftsPage'
import AdminPagesPage from './pages/AdminPagesPage'
import AdminPageEditorPage from './pages/AdminPageEditorPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="posts" element={<PostListPage />} />
        <Route path="posts/:slug" element={<PostDetailPage />} />
        <Route path="introduce" element={<IntroducePage />} />
        <Route path="categories" element={<CategoryPage />} />
        <Route path="categories/:slug" element={<PostListPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="notices" element={<NoticePage />} />
        <Route path="notices/:slug" element={<NoticeDetailPage />} />
        <Route path="privacy" element={<PrivacyPolicyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Admin Login (Public) */}
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* Protected Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="posts" element={<AdminPostsPage />} />
        <Route path="posts/new" element={<AdminPostEditorPage />} />
        <Route path="posts/:id/edit" element={<AdminPostEditorPage />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="drafts" element={<AdminDraftsPage />} />
        <Route path="comments" element={<AdminCommentsPage />} />
        <Route path="pages" element={<AdminPagesPage />} />
        <Route path="pages/:id/edit" element={<AdminPageEditorPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
