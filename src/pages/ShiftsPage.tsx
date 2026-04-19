import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Shift } from '../types'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, X, Clock } from 'lucide-react'

const PRESET_COLORS = ['#3B82F6','#8B5CF6','#1D4ED8','#0891B2','#64748B','#F59E0B','#EF4444','#10B981','#F97316','#EC4899']

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Shift | null>(null)
  const [form, setForm] = useState({ name: '', color: '#3B82F6' })
  const [saving, setSaving] = useState(false)

  const fetchShifts = async () => {
    const { data } = await supabase.from('shifts').select('*').order('created_at')
    setShifts(data || [])
    setLoading(false)
  }
  useEffect(() => { fetchShifts() }, [])

  const openAdd = () => { setForm({ name: '', color: '#3B82F6' }); setEditing(null); setModal(true) }
  const openEdit = (s: Shift) => { setForm({ name: s.name, color: s.color || '#3B82F6' }); setEditing(s); setModal(true) }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('请输入班次名称'); return }
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('shifts').update({ name: form.name, color: form.color }).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('更新成功')
    } else {
      const { error } = await supabase.from('shifts').insert({ name: form.name, color: form.color })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('添加成功')
    }
    setSaving(false); setModal(false); fetchShifts()
  }

  const handleDelete = async (s: Shift) => {
    if (!window.confirm(`确认删除班次「${s.name}」？`)) return
    const { error } = await supabase.from('shifts').delete().eq('id', s.id)
    if (error) { toast.error(error.message.includes('foreign') ? '该班次已被排班引用，无法删除' : error.message); return }
    toast.success('删除成功'); fetchShifts()
  }

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">班次管理</h1>
          <p className="text-sm text-slate-500 mt-0.5">自定义排班班次类型</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />添加班次
        </button>
      </div>

      <div className="card">
        {shifts.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>暂无班次数据</p>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {shifts.map(shift => (
            <div key={shift.id} className="relative group flex flex-col items-center p-4 rounded-xl border-2 transition-all hover:shadow-md"
              style={{ borderColor: shift.color + '40', background: shift.color + '08' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl mb-2 shadow-sm"
                style={{ background: shift.color }}>
                {shift.name}
              </div>
              <span className="text-sm font-medium text-slate-700">{shift.name}</span>
              <div className="flex gap-1 mt-1">
                {shift.is_holiday && <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">假期</span>}
                {shift.is_rest && <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full">休息</span>}
              </div>
              <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                <button onClick={() => openEdit(shift)} className="w-6 h-6 rounded-md bg-white shadow-sm flex items-center justify-center text-slate-500 hover:text-primary-600 cursor-pointer">
                  <Pencil className="w-3 h-3" />
                </button>
                <button onClick={() => handleDelete(shift)} className="w-6 h-6 rounded-md bg-white shadow-sm flex items-center justify-center text-slate-500 hover:text-red-500 cursor-pointer">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{editing ? '编辑班次' : '添加班次'}</h3>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">班次名称</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="如：A、P、N、D、办、休" className="input-base" maxLength={10} autoFocus />
                <p className="text-xs text-slate-400 mt-1">含"假"字自动标记为假期，"停"/"休"自动标记为休息</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">显示颜色</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(color => (
                    <button key={color} type="button" onClick={() => setForm(f => ({ ...f, color }))}
                      className={`w-8 h-8 rounded-full cursor-pointer transition-transform hover:scale-110 ${form.color === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                      style={{ background: color }} />
                  ))}
                </div>
              </div>
              {/* 预览 */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-500">预览：</span>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: form.color }}>{form.name || '班'}</div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">取消</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? '保存中...' : '保存'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
