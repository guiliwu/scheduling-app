import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Department } from '../types'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, ChevronRight, Building2, X } from 'lucide-react'

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; editing?: Department; parentId?: string; type: 'first'|'second' }>({ open: false, type: 'first' })
  const [form, setForm] = useState({ name: '' })
  const [saving, setSaving] = useState(false)

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('*').order('type').order('name')
    setDepartments(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchDepartments() }, [])

  const firstLevel = departments.filter(d => d.type === 'first')
  const getChildren = (parentId: string) => departments.filter(d => d.parent_id === parentId)

  const openAdd = (type: 'first'|'second', parentId?: string) => {
    setForm({ name: '' })
    setModal({ open: true, type, parentId })
  }
  const openEdit = (dept: Department) => {
    setForm({ name: dept.name })
    setModal({ open: true, editing: dept, type: dept.type })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('请输入科室名称'); return }
    setSaving(true)
    if (modal.editing) {
      const { error } = await supabase.from('departments').update({ name: form.name }).eq('id', modal.editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('更新成功')
    } else {
      const { error } = await supabase.from('departments').insert({ name: form.name, type: modal.type, parent_id: modal.parentId || null })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('添加成功')
    }
    setSaving(false)
    setModal({ open: false, type: 'first' })
    fetchDepartments()
  }

  const handleDelete = async (dept: Department) => {
    const children = getChildren(dept.id)
    if (children.length > 0) { toast.error('请先删除下级科室'); return }
    if (!window.confirm(`确认删除「${dept.name}」？此操作不可撤销。`)) return
    const { error } = await supabase.from('departments').delete().eq('id', dept.id)
    if (error) { toast.error(error.message.includes('foreign') ? '该科室已有关联数据，无法删除' : error.message); return }
    toast.success('删除成功')
    fetchDepartments()
  }

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">科室管理</h1>
          <p className="text-sm text-slate-500 mt-0.5">管理一级片区和二级科室</p>
        </div>
        <button onClick={() => openAdd('first')} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />添加一级科室
        </button>
      </div>

      <div className="space-y-3">
        {firstLevel.length === 0 && (
          <div className="card text-center py-12 text-slate-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>暂无科室，点击上方按钮添加</p>
          </div>
        )}
        {firstLevel.map(parent => {
          const children = getChildren(parent.id)
          return (
            <div key={parent.id} className="card p-0 overflow-hidden">
              {/* 一级科室 */}
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5 text-primary-600" />
                </div>
                <span className="font-semibold text-slate-700 flex-1">{parent.name}</span>
                <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded-full border">一级片区</span>
                <button onClick={() => openAdd('second', parent.id)}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 px-2 py-1 rounded-md hover:bg-primary-50 cursor-pointer transition-colors">
                  <Plus className="w-3.5 h-3.5" />添加科室
                </button>
                <button onClick={() => openEdit(parent)} className="p-1.5 rounded-md hover:bg-slate-200 cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(parent)} className="p-1.5 rounded-md hover:bg-red-50 cursor-pointer text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* 二级科室 */}
              {children.length > 0 && (
                <div className="divide-y divide-slate-50">
                  {children.map(child => (
                    <div key={child.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-2" />
                      <span className="text-sm text-slate-700 flex-1">{child.name}</span>
                      <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded-full border">二级科室</span>
                      <button onClick={() => openEdit(child)} className="p-1.5 rounded-md hover:bg-slate-200 cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(child)} className="p-1.5 rounded-md hover:bg-red-50 cursor-pointer text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {children.length === 0 && (
                <div className="px-8 py-3 text-sm text-slate-400 italic">暂无下级科室</div>
              )}
            </div>
          )
        })}
      </div>

      {/* 弹窗 */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">
                {modal.editing ? '编辑科室' : modal.type === 'first' ? '添加一级科室' : '添加二级科室'}
              </h3>
              <button onClick={() => setModal({ open: false, type: 'first' })} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">科室名称</label>
                <input type="text" value={form.name} onChange={e => setForm({ name: e.target.value })}
                  placeholder="请输入科室名称" className="input-base" autoFocus />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setModal({ open: false, type: 'first' })} className="btn-secondary flex-1">取消</button>
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
