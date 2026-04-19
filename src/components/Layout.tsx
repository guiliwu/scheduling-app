import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { UserRole, ROLE_LABELS } from '../types'
import {
  LayoutDashboard, Users, Building2, Clock, Calendar,
  BarChart3, Settings, LogOut, Menu, X, ChevronDown,
  ClipboardCheck, Hospital, Bell
} from 'lucide-react'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  roles: UserRole[]
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" />, label: '首页', roles: ['super_admin','general_admin','sub_admin','admin','teacher','student'] },
  { to: '/departments', icon: <Building2 className="w-4 h-4" />, label: '科室管理', roles: ['super_admin','general_admin'] },
  { to: '/shifts', icon: <Clock className="w-4 h-4" />, label: '班次管理', roles: ['super_admin','general_admin'] },
  { to: '/teachers', icon: <Users className="w-4 h-4" />, label: '老师管理', roles: ['super_admin','general_admin'] },
  { to: '/students', icon: <Users className="w-4 h-4" />, label: '学生管理', roles: ['super_admin','general_admin'] },
  { to: '/schedule', icon: <Calendar className="w-4 h-4" />, label: '排班管理', roles: ['admin','general_admin','super_admin','teacher','student'] },
  { to: '/review', icon: <ClipboardCheck className="w-4 h-4" />, label: '排班审核', roles: ['sub_admin','general_admin','super_admin'] },
  { to: '/statistics', icon: <BarChart3 className="w-4 h-4" />, label: '统计报表', roles: ['super_admin','general_admin','sub_admin','admin'] },
  { to: '/accounts', icon: <Settings className="w-4 h-4" />, label: '账号管理', roles: ['super_admin','general_admin'] },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const navigate = useNavigate()

  const allowedNav = navItems.filter(item =>
    profile?.role && item.roles.includes(profile.role)
  )

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const roleColor = {
    super_admin: 'bg-purple-100 text-purple-700',
    general_admin: 'bg-blue-100 text-blue-700',
    sub_admin: 'bg-indigo-100 text-indigo-700',
    admin: 'bg-cyan-100 text-cyan-700',
    teacher: 'bg-green-100 text-green-700',
    student: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* 侧边栏遮罩（移动端） */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 侧边栏 */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 shadow-lg lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
            <Hospital className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">排班管理系统</p>
            <p className="text-xs text-slate-400">Schedule System</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden cursor-pointer text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 导航 */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {allowedNav.map(item => (
            <NavLink key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`
              }>
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* 用户信息 */}
        <div className="p-3 border-t border-slate-100">
          <div className="relative">
            <button onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <span className="text-primary-700 text-sm font-semibold">
                  {profile?.name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium text-slate-700 truncate">{profile?.name || '用户'}</p>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${roleColor[profile?.role || 'student']}`}>
                  {ROLE_LABELS[profile?.role || 'student']}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg border border-slate-100 py-1 animate-slide-down">
                <NavLink to="/change-password" onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer">
                  <Settings className="w-4 h-4" />修改密码
                </NavLink>
                <button onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 cursor-pointer">
                  <LogOut className="w-4 h-4" />退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 顶部导航 */}
        <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden cursor-pointer text-slate-500 hover:text-slate-700">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer transition-colors">
            <Bell className="w-4 h-4" />
          </button>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
