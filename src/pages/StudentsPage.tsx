import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Student, STUDENT_TYPE_LABELS } from '../types'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { Plus, Pencil, Trash2, X, Upload, Download, Search, GraduationCap } from 'lucide-react'

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState({ student_id: '', name: '', education: '本科', student_type: 'intern' as Student['student_type'], school_name: '' })
  const [saving, setSaving] = useState(false)
  const [importLoading, setImportLoading] = useState(false)

  const fetchData = async () => {
    const { data } = await supabase.from('students').select('*').order('created_at', { ascending: false })
    setStudents(data || [])
    setLoading(false)
  }
  useEffect(() => { fetchData() }, [])

  const filtered = students.filter(s => s.name.includes(search) || s.student_id.includes(search) || s.school_name.includes(search))

  const openAdd = () => { setForm({ student_id: '', name: '', education: '本科', student_type: 'intern', school_name: '' }); setEditing(null); setModal(true) }
  const openEdit = (s: Student) => { setForm({ student_id: s.student_id, name: s.name, education: s.education, student_type: s.student_type, school_name: s.school_name }); setEditing(s); setModal(true) }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.student_id.trim() || !form.name.trim()) { toast.error('学号和姓名为必填项'); return }
    setSaving(true)
    const payload = { student_id: form.student_id, name: form.name, education: form.education, student_type: form.student_type, school_name: form.school_name }
    if (editing) {
      const { error } = await supabase.from('students').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message.includes('unique') ? '学号已存在' : error.message); setSaving(false); return }
      toast.success('更新成功')
    } else {
      const { error } = await supabase.from('students').insert(payload)
      if (error) { toast.error(error.message.includes('unique') ? '学号已存在' : error.message); setSaving(false); return }
      toast.success('添加成功')
    }
    setSaving(false); setModal(false); fetchData()
  }

  const handleDelete = async (s: Student) => {
    if (!window.confirm(`确认删除学生「${s.name}（${s.student_id}）」？`)) return
    const { error } = await supabase.from('students').delete().eq('id', s.id)
    if (error) { toast.error(error.message); return }
    toast.success('删除成功'); fetchData()
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['学号', '姓名', '学历', '类型（实习生/研究生/进修生/其他）', '学校/单位名称'],
      ['S001', '王五', '本科', '实习生', '北京医科大学'],
      ['S002', '赵六', '硕士', '研究生', '协和医学院'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '学生导入模板')
    XLSX.writeFile(wb, '学生导入模板.xlsx')
  }

  const typeMap: Record<string, Student['student_type']> = {
    '实习生': 'intern', '研究生': 'graduate', '进修生': 'advanced', '其他': 'other'
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
      let success = 0, errs: string[] = []
      for (const row of rows) {
        if (!row[0] || !row[1]) continue
        const t = typeMap[row[3]] || 'intern'
        const { error } = await supabase.from('students').upsert({
          student_id: String(row[0]), name: String(row[1]), education: row[2] || '本科',
          student_type: t, school_name: row[4] || ''
        }, { onConflict: 'student_id' })
        if (error) errs.push(`${row[0]}: ${error.message}`)
        else success++
      }
      setImportLoading(false)
      if (errs.length > 0) toast.error(`导入完成，${success}条成功，${errs.length}条失败`)
      else toast.success(`成功导入 ${success} 条`)
      fetchData()
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const typeColors: Record<Student['student_type'], string> = {
    intern: 'bg-blue-50 text-blue-700',
    graduate: 'bg-purple-50 text-purple-700',
    advanced: 'bg-green-50 text-green-700',
    other: 'bg-slate-50 text-slate-600',
  }

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">学生管理</h1>
          <p className="text-sm text-slate-500 mt-0.5">共 {students.length} 名学生</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={downloadTemplate} className="btn-secondary flex items-center gap-2 text-sm"><Download className="w-4 h-4" />模板</button>
          <label className="btn-secondary flex items-center gap-2 text-sm cursor-pointer">
            <Upload className="w-4 h-4" />{importLoading ? '导入中...' : '批量导入'}
            <input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm"><Plus className="w-4 h-4" />添加学生</button>
        </div>
      </div>

      <div className="card">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索学号、姓名、学校..." className="input-base pl-9" />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{search ? '未找到匹配的学生' : '暂无学生数据，请添加或批量导入'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="pb-3 pr-4">学号</th><th className="pb-3 pr-4">姓名</th>
                  <th className="pb-3 pr-4">学历</th><th className="pb-3 pr-4">类型</th>
                  <th className="pb-3 pr-4">学校/单位</th><th className="pb-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(s => (
                  <tr key={s.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="table-cell font-mono text-sm">{s.student_id}</td>
                    <td className="table-cell font-medium">{s.name}</td>
                    <td className="table-cell text-slate-500">{s.education}</td>
                    <td className="table-cell"><span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[s.student_type]}`}>{STUDENT_TYPE_LABELS[s.student_type]}</span></td>
                    <td className="table-cell text-slate-500 max-w-[160px] truncate">{s.school_name || '-'}</td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-md hover:bg-slate-200 cursor-pointer text-slate-500 hover:text-primary-600"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(s)} className="p-1.5 rounded-md hover:bg-red-50 cursor-pointer text-slate-500 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
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
              <h3 className="font-semibold text-slate-800">{editing ? '编辑学生' : '添加学生'}</h3>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">学号 <span className="text-red-500">*</span></label>
                  <input type="text" value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} className="input-base" disabled={!!editing} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">姓名 <span className="text-red-500">*</span></label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-base" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">学历</label>
                  <input type="text" value={form.education} onChange={e => setForm(f => ({ ...f, education: e.target.value }))} placeholder="如：本科、硕士" className="input-base" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">类型 <span className="text-red-500">*</span></label>
                  <select value={form.student_type} onChange={e => setForm(f => ({ ...f, student_type: e.target.value as Student['student_type'] }))} className="input-base">
                    <option value="intern">实习生</option>
                    <option value="graduate">研究生</option>
                    <option value="advanced">进修生</option>
                    <option value="other">其他</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">学校/单位名称</label>
                <input type="text" value={form.school_name} onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))} placeholder="如：北京医科大学" className="input-base" />
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
