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
import AdminLoginPage from './pages/AdminLoginPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminPostEditorPage from './pages/AdminPostEditorPage'
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
        <Route path="posts/new" element={<AdminPostEditorPage />} />
        <Route path="posts/:id/edit" element={<AdminPostEditorPage />} />
        {/* Add more admin routes here */}
        {/* <Route path="posts" element={<AdminPostsPage />} /> */}
        {/* <Route path="categories" element={<AdminCategoriesPage />} /> */}
        {/* <Route path="drafts" element={<AdminDraftsPage />} /> */}
        {/* <Route path="comments" element={<AdminCommentsPage />} /> */}
        {/* <Route path="settings" element={<AdminSettingsPage />} /> */}
      </Route>
    </Routes>
  )
}

export default App
