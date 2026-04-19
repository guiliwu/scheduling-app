import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Hospital, Lock, User } from 'lucide-react'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) { setError('请输入工号/学号/邮箱'); return }
    setLoading(true)
    setError('')
    const { error: err } = await signIn(identifier.trim(), password)
    setLoading(false)
    if (err) {
      setError(err.includes('Invalid') ? '账号或密码错误' : err)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 40%, #3b82f6 70%, #60a5fa 100%)' }}>
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl animate-pulse" style={{animationDelay:'1s'}} />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-2xl" />
      </div>

      <div className="w-full max-w-md px-6 relative z-10">
        {/* Logo 区域 */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 shadow-lg">
            <Hospital className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">学生排班管理系统</h1>
          <p className="text-blue-100 text-sm">Student Schedule Management System</p>
        </div>

        {/* 登录卡片 */}
        <div className="glass-card rounded-2xl p-8 animate-slide-up" style={{animationDelay:'0.1s'}}>
          <h2 className="text-xl font-semibold text-slate-800 mb-6">登录账号</h2>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-red-500 flex-shrink-0 flex items-center justify-center text-white text-xs">!</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                工号 / 学号 / 邮箱
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="请输入工号、学号或管理员邮箱"
                  className="input-base pl-10"
                  autoComplete="username"
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">老师/管理员使用工号，学生使用学号，超级管理员使用邮箱</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="请输入密码（首次登录可直接点击登录）"
                  className="input-base pl-10 pr-10"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 h-11 text-base mt-2">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  登录中...
                </>
              ) : '登 录'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              首次登录将自动注册账号，登录后请修改密码
            </p>
          </div>
        </div>

        <p className="text-center text-blue-200 text-xs mt-6">
          © 2026 学生排班管理系统 · 安全可靠
        </p>
      </div>
    </div>
  )
}
