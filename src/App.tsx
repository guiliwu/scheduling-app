import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

// 页面组件
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DepartmentsPage from './pages/DepartmentsPage'
import ShiftsPage from './pages/ShiftsPage'
import TeachersPage from './pages/TeachersPage'
import StudentsPage from './pages/StudentsPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import SchedulePage from './pages/SchedulePage'
import ReviewPage from './pages/ReviewPage'
import StatisticsPage from './pages/StatisticsPage'
import AccountsPage from './pages/AccountsPage'

export default function App() {
  return (
    <Routes>
      {/* 公开页面：登录 */}
      <Route path="/login" element={<LoginPage />} />

      {/* 受保护的路由（需要登录） */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* 默认重定向到仪表盘 */}
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* 已完成的页面 */}
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="shifts" element={<ShiftsPage />} />
        <Route path="teachers" element={<TeachersPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="change-password" element={<ChangePasswordPage />} />

        <Route path="schedule" element={<SchedulePage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="statistics" element={<StatisticsPage />} />
        <Route path="accounts" element={<AccountsPage />} />

        {/* 404 兜底 */}
        <Route path="*" element={
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <p className="text-2xl font-bold mb-2">404</p>
            <p className="text-sm">页面不存在</p>
          </div>
        } />
      </Route>
    </Routes>
  )
}
