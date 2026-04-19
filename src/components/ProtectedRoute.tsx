import { useAuth } from '../contexts/AuthContext'
import { Navigate, useLocation } from 'react-router-dom'
import ChangePasswordPage from '../pages/ChangePasswordPage'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">加载中...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  // 首次登录强制改密
  if (profile?.must_change_password && location.pathname !== '/change-password') {
    return <ChangePasswordPage onSuccess={() => window.location.replace('/dashboard')} />
  }

  return <>{children}</>
}
