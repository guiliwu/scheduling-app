import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'

interface ChangePasswordPageProps {
  onSuccess?: () => void
}

export default function ChangePasswordPage({ onSuccess }: ChangePasswordPageProps) {
  const { refreshProfile, profile } = useAuth()
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirm: '' })
  const [show, setShow] = useState({ old: false, new: false, confirm: false })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.newPassword.length < 6) { toast.error('新密码至少6位'); return }
    if (form.newPassword !== form.confirm) { toast.error('两次密码不一致'); return }
    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password: form.newPassword })
    if (error) { toast.error(error.message); setLoading(false); return }

    // 更新必须改密标志
    if (profile) {
      await supabase.from('profiles').update({ must_change_password: false }).eq('user_id', profile.user_id)
      await refreshProfile()
    }
    toast.success('密码修改成功！')
    setLoading(false)
    onSuccess?.()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md px-6">
        <div className="card animate-scale-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">修改初始密码</h2>
              <p className="text-sm text-slate-500">首次登录请设置您的新密码</p>
            </div>
          </div>

          <div className="mb-5 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-700 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              为保障账号安全，请设置一个至少6位的新密码，后续使用新密码登录。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: 'newPassword', label: '新密码', showKey: 'new', placeholder: '请设置新密码（至少6位）' },
              { key: 'confirm', label: '确认新密码', showKey: 'confirm', placeholder: '再次输入新密码' },
            ].map(({ key, label, showKey, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>
                <div className="relative">
                  <input
                    type={show[showKey as keyof typeof show] ? 'text' : 'password'}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="input-base pr-10"
                  />
                  <button type="button"
                    onClick={() => setShow(s => ({ ...s, [showKey]: !s[showKey as keyof typeof s] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                    {show[showKey as keyof typeof show] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn-primary w-full h-10">
              {loading ? '保存中...' : '确认修改'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
