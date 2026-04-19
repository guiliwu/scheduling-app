import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Profile, UserRole, ROLE_LABELS, Department } from '../types'
import toast from 'react-hot-toast'
import {
  Users, Search, Shield, KeyRound, Pencil, X,
  ChevronDown, UserCog, AlertTriangle, CheckCircle2,
} from 'lucide-react'

export default function AccountsPage() {
  const { profile: currentProfile, refreshProfile } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')

  // 编辑弹窗
  const [editModal, setEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editForm, setEditForm] = useState<{
    role: UserRole
    department_id?: string
    managed_department_ids?: string[]
    name: string
  }>({
    role: 'student',
    name: '',
  })
  const [saving, setSaving] = useState(false)

  // 加载数据
  useEffect(() => {
    const fetchData = async () => {
      const [profilesRes, deptsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('departments').select('*').order('name'),
      ])
      setProfiles(profilesRes.data || [])
      setDepartments(deptsRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  // 过滤
  const filtered = profiles.filter(p => {
    if (roleFilter && p.role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        (p.employee_id || '').toLowerCase().includes(q) ||
        (p.student_id || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  // 打开编辑弹窗
  const openEdit = (user: Profile) => {
    setEditingUser(user)
    setEditForm({
      role: user.role,
      department_id: user.department_id || '',
      managed_department_ids: user.managed_department_ids || [],
      name: user.name,
    })
    setEditModal(true)
  }

  // 保存编辑
  const handleSave = async () => {
    if (!editingUser) return
    setSaving(true)

    const updateData: any = {
      role: editForm.role,
      name: editForm.name,
      department_id: editForm.department_id || null,
      managed_department_ids: editForm.managed_department_ids?.length
        ? editForm.managed_department_ids
        : null,
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', editingUser.id)

    if (error) {
      toast.error(error.message)
      setSaving(false)
      return
    }

    toast.success('账号信息已更新')
    setProfiles(prev => prev.map(p =>
      p.id === editingUser.id ? { ...p, ...updateData } : p
    ))
    setEditModal(false)
    setSaving(false)

    // 如果编辑的是当前用户，刷新 profile
    if (editingUser.id === currentProfile?.id) {
      refreshProfile()
    }
  }

  // 重置密码
  const handleResetPassword = async (user: Profile) => {
    if (!window.confirm(
      `确认重置「${user.name}」的密码为初始密码（123456）？\n\n该用户下次登录时将需要修改密码。`
    )) return

    // 通过 Supabase Auth Admin API 或直接更新用户元数据
    // 这里采用更新 must_change_password + 提示管理员通知的方式
    const { error } = await supabase
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', user.id)

    if (error) {
      toast.error(error.message)
      return
    }

    // 尝试通过 Supabase Auth 更新密码（需要 admin 权限）
    try {
      const { error: authError } = await supabase.auth.admin.updateUserById(
        user.user_id,
        { password: '123456' }
      )
      if (authError) throw authError
    } catch {
      toast.warning('已标记需要改密，但自动重置密码失败。请联系系统管理员手动重置。')
      setProfiles(prev => prev.map(p =>
        p.id === user.id ? { ...p, must_change_password: true } : p
      ))
      return
    }

    toast.success(`已重置「${user.name}」的密码为 123456`)
    setProfiles(prev => prev.map(p =>
      p.id === user.id ? { ...p, must_change_password: true } : p
    ))
  }

  // ====== 样式常量 ======
  const roleColors: Record<UserRole, string> = {
    super_admin: 'bg-purple-100 text-purple-700',
    general_admin: 'bg-blue-100 text-blue-700',
    sub_admin: 'bg-indigo-100 text-indigo-700',
    admin: 'bg-cyan-100 text-cyan-700',
    teacher: 'bg-green-100 text-green-700',
    student: 'bg-slate-100 text-slate-600',
  }

  const roleIconColors: Record<UserRole, string> = {
    super_admin: 'text-purple-500 bg-purple-50',
    general_admin: 'text-blue-500 bg-blue-50',
    sub_admin: 'text-indigo-500 bg-indigo-50',
    admin: 'text-cyan-500 bg-cyan-50',
    teacher: 'text-green-500 bg-green-50',
    student: 'text-slate-400 bg-slate-50',
  }

  const secondDepts = departments.filter(d => d.type === 'second')

  // ====== 渲染 ======
  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  }

  return (
    <div className="animate-fade-in">
      {/* 头部 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">账号管理</h1>
        <p className="text-sm text-slate-500 mt-0.5">管理系统用户账号、角色权限和科室绑定</p>
      </div>

      {/* 筛选区 */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] max-w-[320px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索姓名、工号、学号..."
                className="input-base pl-9"
              />
            </div>
          </div>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as any)}
            className="input-base w-[150px]"
          >
            <option value="">全部角色</option>
            {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>

          <span className="text-sm text-slate-400 ml-auto">
            共 {filtered.length} 个账号
          </span>
        </div>
      </div>

      {/* 账号列表 */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-400">{search || roleFilter ? '未找到匹配的账号' : '暂无账号数据'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto -mx-6 px-6 max-h-[calc(100vh-320px)] overflow-y-auto">
            <table className="w-full min-w-[750px]">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="pb-3 pr-4">用户信息</th>
                  <th className="pb-3 pr-4">角色</th>
                  <th className="pb-3 pr-4">工号 / 学号</th>
                  <th className="pb-3 pr-4">所属科室</th>
                  <th className="pb-3 pr-4">状态</th>
                  <th className="pb-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(user => (
                  <tr key={user.id} className="group hover:bg-slate-50/30 transition-colors">
                    {/* 用户信息 */}
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${roleIconColors[user.role]}`}>
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <p className={`font-medium ${user.id === currentProfile?.id ? 'text-primary-600' : 'text-slate-800'}`}>
                            {user.name}
                            {user.id === currentProfile?.id && (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-500 font-normal">当前用户</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{user.user_id.substring(0, 8)}...</p>
                        </div>
                      </div>
                    </td>

                    {/* 角色 */}
                    <td className="py-3.5 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[user.role]}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>

                    {/* 工号 / 学号 */}
                    <td className="py-3.5 pr-4 font-mono text-sm text-slate-500">
                      {user.employee_id || user.student_id || '-'}
                    </td>

                    {/* 科室 */}
                    <td className="py-3.5 pr-4 text-sm text-slate-500">
                      {user.department_id
                        ? departments.find(d => d.id === user.department_id)?.name || '-'
                        : '-'
                      }
                      {user.managed_department_ids && user.managed_department_ids.length > 0 && (
                        <span className="ml-1 text-[10px] text-indigo-400">
                          (+{user.managed_department_ids.length}管辖)
                        </span>
                      )}
                    </td>

                    {/* 状态 */}
                    <td className="py-3.5 pr-4">
                      {user.must_change_password ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                          <KeyRound className="w-3 h-3" />待改密
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">
                          <CheckCircle2 className="w-3 h-3" />正常
                        </span>
                      )}
                    </td>

                    {/* 操作 */}
                    <td className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(user)}
                          className="p-1.5 rounded-md hover:bg-slate-200 cursor-pointer text-slate-500 hover:text-primary-600"
                          title="编辑"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(user)}
                          className="p-1.5 rounded-md hover:bg-amber-50 cursor-pointer text-slate-500 hover:text-amber-600"
                          title="重置密码"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========== 编辑弹窗 ========== */}
      {editModal && editingUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setEditModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <UserCog className="w-5 h-5 text-primary-500" />
                编辑账号 - {editingUser.name}
              </h3>
              <button onClick={() => setEditModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleSave() }} className="p-6 space-y-4">
              {/* 姓名 */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">姓名</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="input-base"
                />
              </div>

              {/* 角色 */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">角色</label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  className="input-base"
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                {editForm.role !== editingUser.role && editForm.role === 'super_admin' && (
                  <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>超级管理员拥有最高权限，请谨慎分配此角色。</span>
                  </div>
                )}
              </div>

              {/* 所属科室（非学生角色可用） */}
              {editForm.role !== 'student' && editForm.role !== 'teacher' && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">所属科室</label>
                  <select
                    value={editForm.department_id || ''}
                    onChange={e => setEditForm(f => ({ ...f, department_id: e.target.value }))}
                    className="input-base"
                  >
                    <option value="">-- 无 --</option>
                    {secondDepts.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 管辖科室（分管理员专用） */}
              {editForm.role === 'sub_admin' && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">管辖科室（可多选）</label>
                  <div className="max-h-[120px] overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                    {secondDepts.map(d => (
                      <label key={d.id} className="flex items-center gap-2 cursor-pointer px-1.5 py-1 rounded hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={(editForm.managed_department_ids || []).includes(d.id)}
                          onChange={e => {
                            const ids = [...(editForm.managed_department_ids || [])]
                            if (e.target.checked) {
                              ids.push(d.id)
                              setEditForm(f => ({ ...f, managed_department_ids: ids }))
                            } else {
                              setEditForm(f => ({ ...f, managed_department_ids: ids.filter(x => x !== d.id) }))
                            }
                          }}
                          className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                        />
                        <span className="text-sm text-slate-600">{d.name}</span>
                      </label>
                    ))}
                  </div>
                  {!secondDepts.length && (
                    <p className="text-xs text-slate-400 mt-1">暂无二级科室，请先在科室管理中添加</p>
                  )}
                </div>
              )}

              {/* 按钮 */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditModal(false)} className="btn-secondary flex-1">取消</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
