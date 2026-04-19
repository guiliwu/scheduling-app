import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Teacher, Department, TEACHER_TYPE_LABELS } from '../types'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { Plus, Pencil, Trash2, X, Upload, Download, Search, Users } from 'lucide-react'

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<(Teacher & { departments?: Department[] })[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [form, setForm] = useState({ employee_id: '', name: '', title: '', teacher_type: 'teaching_teacher' as Teacher['teacher_type'], dept_id: '' })
  const [saving, setSaving] = useState(false)
  const [importLoading, setImportLoading] = useState(false)

  const fetchData = async () => {
    const [{ data: t }, { data: d }] = await Promise.all([
      supabase.from('teachers').select('*').order('created_at', { ascending: false }),
      supabase.from('departments').select('*').eq('type', 'second').order('name')
    ])
    setTeachers(t || [])
    setDepartments(d || [])
    setLoading(false)
  }
  useEffect(() => { fetchData() }, [])

  const filtered = teachers.filter(t =>
    t.name.includes(search) || t.employee_id.includes(search) || t.title?.includes(search)
  )

  const openAdd = () => {
    setForm({ employee_id: '', name: '', title: '', teacher_type: 'teaching_teacher', dept_id: '' })
    setEditing(null); setModal(true)
  }
  const openEdit = (t: Teacher) => {
    setForm({ employee_id: t.employee_id, name: t.name, title: t.title || '', teacher_type: t.teacher_type, dept_id: '' })
    setEditing(t); setModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.employee_id.trim() || !form.name.trim()) { toast.error('工号和姓名为必填项'); return }
    setSaving(true)
    const payload = { employee_id: form.employee_id, name: form.name, title: form.title || null, teacher_type: form.teacher_type }
    if (editing) {
      const { error } = await supabase.from('teachers').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message.includes('unique') ? '工号已存在' : error.message); setSaving(false); return }
      toast.success('更新成功')
    } else {
      const { error } = await supabase.from('teachers').insert(payload)
      if (error) { toast.error(error.message.includes('unique') ? '工号已存在' : error.message); setSaving(false); return }
      toast.success('添加成功')
    }
    setSaving(false); setModal(false); fetchData()
  }

  const handleDelete = async (t: Teacher) => {
    if (!window.confirm(`确认删除老师「${t.name}（${t.employee_id}）」？`)) return
    const { error } = await supabase.from('teachers').delete().eq('id', t.id)
    if (error) { toast.error(error.message); return }
    toast.success('删除成功'); fetchData()
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['工号', '姓名', '职称', '类型（总带教/带教老师/带班老师）'],
      ['T001', '张三', '主治医师', '带教老师'],
      ['T002', '李四', '护士长', '总带教'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '老师导入模板')
    XLSX.writeFile(wb, '老师导入模板.xlsx')
  }

  const typeMap: Record<string, Teacher['teacher_type']> = {
    '总带教': 'head_teacher', '带教老师': 'teaching_teacher', '带班老师': 'class_teacher'
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportLoading(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 }).slice(1)
      let success = 0, errors: string[] = []
      for (const row of rows) {
        if (!row[0] || !row[1]) continue
        const t = typeMap[row[3]] || 'teaching_teacher'
        const { error } = await supabase.from('teachers').upsert({ employee_id: String(row[0]), name: String(row[1]), title: row[2] || null, teacher_type: t }, { onConflict: 'employee_id' })
        if (error) errors.push(`${row[0]}: ${error.message}`)
        else success++
      }
      setImportLoading(false)
      if (errors.length > 0) toast.error(`导入完成，${success}条成功，${errors.length}条失败`)
      else toast.success(`成功导入 ${success} 条`)
      fetchData()
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">老师管理</h1>
          <p className="text-sm text-slate-500 mt-0.5">共 {teachers.length} 名老师</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" />模板
          </button>
          <label className="btn-secondary flex items-center gap-2 text-sm cursor-pointer">
            <Upload className="w-4 h-4" />{importLoading ? '导入中...' : '批量导入'}
            <input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />添加老师
          </button>
        </div>
      </div>

      <div className="card">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索工号、姓名、职称..." className="input-base pl-9" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{search ? '未找到匹配的老师' : '暂无老师数据，请添加或批量导入'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="pb-3 pr-4">工号</th>
                  <th className="pb-3 pr-4">姓名</th>
                  <th className="pb-3 pr-4">职称</th>
                  <th className="pb-3 pr-4">类型</th>
                  <th className="pb-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(t => (
                  <tr key={t.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="table-cell font-mono text-sm">{t.employee_id}</td>
                    <td className="table-cell font-medium">{t.name}</td>
                    <td className="table-cell text-slate-500">{t.title || '-'}</td>
                    <td className="table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        {TEACHER_TYPE_LABELS[t.teacher_type]}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-md hover:bg-slate-200 cursor-pointer text-slate-500 hover:text-primary-600"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(t)} className="p-1.5 rounded-md hover:bg-red-50 cursor-pointer text-slate-500 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{editing ? '编辑老师' : '添加老师'}</h3>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">工号 <span className="text-red-500">*</span></label>
                  <input type="text" value={form.employee_id} onChange={e => setForm(f=>({...f,employee_id:e.target.value}))} className="input-base" disabled={!!editing} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">姓名 <span className="text-red-500">*</span></label>
                  <input type="text" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} className="input-base" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">职称</label>
                  <input type="text" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="如：主治医师" className="input-base" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">类型 <span className="text-red-500">*</span></label>
                  <select value={form.teacher_type} onChange={e => setForm(f=>({...f,teacher_type:e.target.value as Teacher['teacher_type']}))} className="input-base">
                    <option value="head_teacher">总带教</option>
                    <option value="teaching_teacher">带教老师</option>
                    <option value="class_teacher">带班老师</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
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
