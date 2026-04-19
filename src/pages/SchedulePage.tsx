import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ScheduleEntry, SchedulePeriod, ScheduleStatus, Student, Shift, Teacher, Department, SCHEDULE_STATUS_LABELS, ROLE_LABELS } from '../types'
import {
  format, addWeeks, subWeeks, addMonths, subMonths, startOfWeek,
  endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth, isSameDay,
  parseISO,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  ChevronLeft, ChevronRight, CalendarDays, Save, Send, Eye,
  Plus, Trash2, X, Copy, GripVertical, Clock, UserCheck,
  AlertCircle, CheckCircle2, FileEdit,
} from 'lucide-react'

// ====== 类型定义 ======
type ViewMode = 'week' | 'month'

interface CellData {
  entryId?: string
  shiftId?: string
  shiftName?: string
  teacherId?: string
  teacherName?: string
  color?: string
}

// ====== 常量 ======
const SHIFT_COLOR_MAP: Record<string, string> = {}
const DEFAULT_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]
let colorIndex = 0
export function getShiftColor(shiftName: string, color?: string): string {
  if (color) return color
  if (!SHIFT_COLOR_MAP[shiftName]) {
    SHIFT_COLOR_MAP[shiftName] = DEFAULT_COLORS[colorIndex % DEFAULT_COLORS.length]
    colorIndex++
  }
  return SHIFT_COLOR_MAP[shiftName]
}

// ====== 主组件 ======
export default function SchedulePage() {
  const { profile } = useAuth()
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [periods, setPeriods] = useState<SchedulePeriod[]>([])
  const [activePeriod, setActivePeriod] = useState<SchedulePeriod | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDept, setSelectedDept] = useState<string>('')
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [cellMap, setCellMap] = useState<Record<string, CellData>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 选区状态（拖拽填充用）
  const [selecting, setSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{ studentIdx: number; dateIdx: number } | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<{ studentIdx: number; dateIdx: number } | null>(null)
  // 复制缓冲
  const [clipboard, setClipboard] = useState<CellData | null>(null)

  // 弹窗状态
  const [cellModal, setCellModal] = useState<{
    open: boolean; studentIdx: number; dateIdx: number; dateStr: string; student: Student
  } | null>(null)
  const [periodModal, setPeriodModal] = useState(false)
  const [newPeriodMonth, setNewPeriodMonth] = useState<number>(() => new Date().getMonth() + 1)
  const [statusAction, setStatusAction] = useState<'publish' | 'submit' | null>(null)

  // ====== 数据加载 ======
  const fetchDepartments = useCallback(async () => {
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepartments(data || [])
  }, [])

  const fetchStudents = useCallback(async (deptId: string) => {
    // 根据角色和科室获取学生列表
    let query = supabase.from('students').select('*').order('name')
    // 学生表本身没有 department_id，这里先取全部学生
    // 实际场景中可能需要通过其他关联表过滤，暂时取全部
    const { data } = await query
    setStudents(data || [])
  }, [])

  const fetchShifts = useCallback(async () => {
    const { data } = await supabase.from('shifts').select('*').order('name')
    setShifts(data || [])
  }, [])

  const fetchTeachers = useCallback(async () => {
    const { data } = await supabase.from('teachers').select('*').order('name')
    setTeachers(data || [])
  }, [])

  const fetchPeriods = useCallback(async (deptId: string) => {
    const now = new Date()
    const { data } = await supabase
      .from('schedule_periods')
      .select('*, department(*)')
      .eq('department_id', deptId)
      .eq('year', now.getFullYear())
      .order('created_at', { ascending: false })
    setPeriods(data || [])
  }, [])

  const fetchEntries = useCallback(async (periodId: string) => {
    const { data } = await supabase
      .from('schedule_entries')
      .select('*, student(*), shift(*), teacher(*)')
      .eq('period_id', periodId)
    setEntries(data || [])
    buildCellMap(data || [])
  }, [])

  const buildCellMap = (data: ScheduleEntry[]) => {
    const map: Record<string, CellData> = {}
    for (const e of data) {
      const key = `${e.student_id}_${e.schedule_date}`
      map[key] = {
        entryId: e.id,
        shiftId: e.shift_id || undefined,
        shiftName: e.shift?.name,
        teacherId: e.teacher_id || undefined,
        teacherName: e.teacher?.name,
        color: e.shift?.color,
      }
    }
    setCellMap(map)
  }

  // 初始化加载
  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchDepartments(), fetchShifts(), fetchTeachers()])
      setLoading(false)
    }
    init()
  }, [fetchDepartments, fetchShifts, fetchTeachers])

  // 当选择科室时加载数据
  useEffect(() => {
    if (!selectedDept) return
    fetchStudents(selectedDept)
    fetchPeriods(selectedDept)
  }, [selectedDept, fetchStudents, fetchPeriods])

  // 当选择排班期时加载条目
  useEffect(() => {
    if (!activePeriod) { setEntries([]); setCellMap({}); return }
    fetchEntries(activePeriod.id)
  }, [activePeriod, fetchEntries])

  // ====== 日期计算 ======
  const getDateRange = () => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      return eachDayOfInterval({ start, end })
    } else {
      const start = startOfMonth(currentDate)
      const end = endOfMonth(currentDate)
      return eachDayOfInterval({ start, end })
    }
  }

  const dates = getDateRange()

  const navigateDate = (dir: -1 | 1) => {
    if (viewMode === 'week') {
      setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1))
    } else {
      setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1))
    }
  }

  const goToday = () => setCurrentDate(new Date())

  // ====== 单元格操作 ======
  const getCellKey = (studentId: string, dateStr: string) =>
    `${studentId}_${dateStr}`

  const openCellEditor = (studentIdx: number, dateIdx: number) => {
    const dateStr = format(dates[dateIdx], 'yyyy-MM-dd')
    const student = students[studentIdx]
    if (!student) return
    setCellModal({
      open: true, studentIdx, dateIdx, dateStr, student,
    })
  }

  const handleSaveCell = async (
    studentId: string, dateStr: string,
    shiftId: string | null, teacherId: string | null
  ) => {
    if (!activePeriod) return

    const key = getCellKey(studentId, dateStr)
    const existing = cellMap[key]

    if (existing?.entryId) {
      if (!shiftId && !teacherId) {
        // 删除
        const { error } = await supabase
          .from('schedule_entries')
          .delete()
          .eq('id', existing.entryId)
        if (error) { toast.error(error.message); return }
      } else {
        // 更新
        const { error } = await supabase
          .from('schedule_entries')
          .update({
            shift_id: shiftId || null,
            teacher_id: teacherId || null,
          })
          .eq('id', existing.entryId)
        if (error) { toast.error(error.message); return }
      }
    } else if (shiftId || teacherId) {
      // 新增
      const { error } = await supabase.from('schedule_entries').insert({
        period_id: activePeriod.id,
        student_id: studentId,
        schedule_date: dateStr,
        shift_id: shiftId || null,
        teacher_id: teacherId || null,
        department_id: selectedDept,
      })
      if (error) { toast.error(error.message); return }
    }

    toast.success('已保存')
    fetchEntries(activePeriod.id)
    setCellModal(null)
  }

  // 批量保存（选区填充）
  const handleFillSelection = async (
    shiftId: string | null, teacherId: string | null
  ) => {
    if (!activePeriod || !selectionStart || !selectionEnd) return

    const sMin = Math.min(selectionStart.studentIdx, selectionEnd.studentIdx)
    const sMax = Math.max(selectionStart.studentIdx, selectionEnd.studentIdx)
    const dMin = Math.min(selectionStart.dateIdx, selectionEnd.dateIdx)
    const dMax = Math.max(selectionStart.dateIdx, selectionEnd.dateIdx)

    const toUpsert: any[] = []
    const toDelete: string[] = []

    for (let si = sMin; si <= sMax; si++) {
      for (let di = dMin; di <= dMax; di++) {
        const student = students[si]
        if (!student) continue
        const dateStr = format(dates[di], 'yyyy-MM-dd')
        const key = getCellKey(student.id, dateStr)
        const existing = cellMap[key]

        if (shiftId || teacherId) {
          const payload = {
            period_id: activePeriod.id,
            student_id: student.id,
            schedule_date: dateStr,
            shift_id: shiftId || null,
            teacher_id: teacherId || null,
            department_id: selectedDept,
          }
          if (existing?.entryId) {
            payload.id = existing.entryId
            toUpsert.push(payload)
          } else {
            toUpsert.push(payload)
          }
        } else if (existing?.entryId) {
          toDelete.push(existing.entryId)
        }
      }
    }

    setSaving(true)
    try {
      if (toDelete.length > 0) {
        await supabase.from('schedule_entries').delete().in('id', toDelete)
      }
      if (toUpsert.length > 0) {
        const { error } = await supabase.from('schedule_entries').upsert(toUpsert, {
          onConflict: 'id',
          ignoreDuplicates: false,
        })
        if (error) throw error
      }
      toast.success(`已批量更新 ${toUpsert.length + toDelete.length} 个单元格`)
      fetchEntries(activePeriod.id)
    } catch (e: any) {
      toast.error(e.message || '批量更新失败')
    } finally {
      setSaving(false)
      clearSelection()
    }
  }

  // ====== 选区/复制粘贴操作 ======
  const clearSelection = () => {
    setSelecting(false)
    setSelectionStart(null)
    setSelectionEnd(null)
  }

  const handleCellMouseDown = (studentIdx: number, dateIdx: number) => {
    if (!activePeriod || activePeriod.status !== 'draft') return
    setSelecting(true)
    setSelectionStart({ studentIdx, dateIdx })
    setSelectionEnd({ studentIdx, dateIdx })
  }

  const handleCellMouseEnter = (studentIdx: number, dateIdx: number) => {
    if (!selecting) return
    setSelectionEnd({ studentIdx, dateIdx })
  }

  const handleMouseUp = () => {
    // 保持选中状态，等待用户选择班次或右键菜单
  }

  // 全局鼠标抬起取消选区绘制模式
  useEffect(() => {
    const handleUp = () => { /* keep selection */ }
    window.addEventListener('mouseup', handleUp)
    return () => window.removeEventListener('mouseup', handleUp)
  }, [])

  const isInSelection = (si: number, di: number): boolean => {
    if (!selectionStart || !selectionEnd) return false
    const sMin = Math.min(selectionStart.studentIdx, selectionEnd.studentIdx)
    const sMax = Math.max(selectionStart.studentIdx, selectionEnd.studentIdx)
    const dMin = Math.min(selectionStart.dateIdx, selectionEnd.dateIdx)
    const dMax = Math.max(selectionStart.dateIdx, selectionEnd.dateIdx)
    return si >= sMin && si <= sMax && di >= dMin && di <= dMax
  }

  // 复制当前选区第一个单元格
  const handleCopy = () => {
    if (!selectionStart) return
    const key = getCellKey(students[selectionStart.studentIdx].id, format(dates[selectionStart.dateIdx], 'yyyy-MM-dd'))
    setClipboard(cellMap[key] || null)
    toast.success('已复制')
  }

  // 粘贴到选区
  const handlePaste = () => {
    if (!clipboard || !selectionStart || !selectionEnd || !activePeriod) return
    const shiftId = clipboard.shiftId || null
    const teacherId = clipboard.teacherId || null
    handleFillSelection(shiftId, teacherId)
  }

  // ====== 排班期管理 ======
  const createPeriod = async () => {
    if (!selectedDept) return
    const year = currentDate.getFullYear()
    const month = viewMode === 'month' ? newPeriodMonth : currentDate.getMonth() + 1
    const week = viewMode === 'week' ? getWeekNumber(currentDate) : undefined

    const { data: existing } = await supabase
      .from('schedule_periods')
      .select('id')
      .eq('department_id', selectedDept)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()

    if (existing) {
      toast.error('该月份已有排班期，请从上方列表中选择'); return
    }

    const { data, error } = await supabase.from('schedule_periods').insert({
      department_id: selectedDept,
      year,
      month,
      week,
      status: 'draft',
      created_by: profile?.id,
    }).select('*, department(*)').single()

    if (error) { toast.error(error.message); return }
    toast.success('排班期已创建')
    setPeriods(prev => [data!, ...prev])
    setActivePeriod(data!)
    setPeriodModal(false)
  }

  // ====== 状态流转 ======
  const handleStatusChange = async () => {
    if (!activePeriod || !statusAction) return
    const newStatus: Record<typeof statusAction, ScheduleStatus> = {
      publish: 'published',
      submit: 'pending_archive',
    }

    const actionLabel = statusAction === 'publish' ? '发布' : '提交存档'
    if (!window.confirm(`确认${actionLabel}此排班？`)) return

    const updateData: any = { status: newStatus[statusAction] }
    if (statusAction === 'submit') updateData.submitted_at = new Date().toISOString()

    const { error } = await supabase
      .from('schedule_periods')
      .update(updateData)
      .eq('id', activePeriod.id)

    if (error) { toast.error(error.message); return }
    toast.success(`${actionLabel}成功`)
    setActivePeriod(p => p ? { ...p, ...updateData } : null)
    setPeriods(prev => prev.map(p => p.id === activePeriod.id ? { ...p, ...updateData } : p))
    setStatusAction(null)
  }

  // ====== 辅助函数 ======
  const getWeekNumber = (d: Date): number => {
    const start = startOfWeek(startOfMonth(d), { weekStartsOn: 1 })
    const diffMs = d.getTime() - start.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return Math.floor(diffDays / 7) + 1
  }

  const statusBadge = (status: ScheduleStatus) => {
    const styles: Record<ScheduleStatus, string> = {
      draft: 'bg-slate-100 text-slate-600',
      published: 'bg-blue-50 text-blue-700',
      pending_archive: 'bg-amber-50 text-amber-700',
      archived: 'bg-green-50 text-green-700',
    }
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>
        {SCHEDULE_STATUS_LABELS[status]}
      </span>
    )
  }

  // ====== 渲染 ======
  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  }

  return (
    <div className="animate-fade-in" onMouseUp={handleMouseUp}>
      {/* ========== 顶部控制栏 ========== */}
      <div className="mb-6 space-y-4">
        {/* 科室选择 + 排班期 */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">选择科室</label>
            <select
              value={selectedDept}
              onChange={e => {
                setSelectedDept(e.target.value)
                setActivePeriod(null)
              }}
              className="input-base text-sm w-[180px]"
            >
              <option value="">-- 请选择 --</option>
              {departments.filter(d => d.type === 'second').map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {selectedDept && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">排班期</label>
                <div className="flex items-center gap-2">
                  <select
                    value={activePeriod?.id || ''}
                    onChange={e => {
                      const p = periods.find(x => x.id === e.target.value)
                      setActivePeriod(p || null)
                    }}
                    className="input-base text-sm w-[200px]"
                  >
                    <option value="">-- 新建或选择 --</option>
                    {periods.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.year}年{p.month}月{p.week ? `第${p.week}周` : ''} - {SCHEDULE_STATUS_LABELS[p.status]}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => setPeriodModal(true)}
                    className="btn-secondary text-sm flex items-center gap-1 whitespace-nowrap">
                    <Plus className="w-4 h-4" />新建
                  </button>
                </div>
              </div>

              {activePeriod && (
                <div className="flex items-center gap-2 ml-auto">
                  {statusBadge(activePeriod.status)}

                  {(activePeriod.status === 'draft') && (
                    <>
                      <button onClick={() => setStatusAction('publish')}
                        className="btn-primary text-sm flex items-center gap-1">
                        <FileEdit className="w-4 h-4" />发布
                      </button>
                      <button onClick={() => setStatusAction('submit')}
                        className="btn-secondary text-sm flex items-center gap-1">
                        <Send className="w-4 h-4" />提交存档
                      </button>
                    </>
                  )}

                  {(activePeriod.status === 'published' || activePeriod.status === 'pending_archive') && (
                    <span className="text-xs text-slate-400">
                      {activePeriod.status === 'pending_archive' ? '等待审核中...' : '已发布，可继续编辑'}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 视图切换 & 日期导航 */}
        {activePeriod && (
          <div className="card">
            <div className="flex items-center justify-between flex-wrap gap-3">
              {/* 左侧：视图切换 */}
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary-500" />
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  {(['week', 'month'] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => { setViewMode(mode); clearSelection() }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        viewMode === mode
                          ? 'bg-white text-primary-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {mode === 'week' ? '周视图' : '月视图'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 中间：日期导航 */}
              <div className="flex items-center gap-2">
                <button onClick={() => navigateDate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <ChevronLeft className="w-5 h-5 text-slate-500" />
                </button>
                <button onClick={goToday}
                  className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer">
                  今天
                </button>
                <span className="text-sm font-semibold text-slate-700 min-w-[140px] text-center">
                  {viewMode === 'week'
                    ? `${format(dates[0], 'M月d日', { locale: zhCN })} - ${format(dates[dates.length - 1], 'M月d日', { locale: zhCN })}`
                    : format(currentDate, 'yyyy年M月', { locale: zhCN })
                  }
                </span>
                <button onClick={() => navigateDate(1)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <ChevronRight className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* 右侧：操作按钮 */}
              <div className="flex items-center gap-2">
                {activePeriod.status === 'draft' && (
                  <>
                    <button
                      onClick={handleCopy}
                      disabled={!selectionStart}
                      className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />复制
                    </button>
                    <button
                      onClick={handlePaste}
                      disabled={!clipboard || !selectionStart}
                      className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />粘贴
                    </button>
                    {(selectionStart && selectionEnd) && (
                      <button onClick={() => clearSelection()}
                        className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 cursor-pointer">
                        取消选区
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========== 排班表格 ========== */}
      {activePeriod && students.length > 0 ? (
        <div className="card overflow-hidden p-0">
          <div className="overflow-auto max-h-[calc(100vh-320px)]">
            <table className="w-full border-collapse" style={{ minWidth: dates.length * 90 + 160 }}>
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-50 border-b border-r border-slate-200 px-3 py-2.5 text-left text-xs font-semibold text-slate-600 w-[140px] min-w-[140px]">
                    学生姓名
                  </th>
                  {dates.map((d, i) => {
                    const isToday = isSameDay(d, new Date())
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6
                    return (
                      <th
                        key={i}
                        className={`border-b border-r border-slate-200 px-1 py-2 text-center text-xs font-medium w-[90px] min-w-[90px] ${
                          isToday ? 'bg-primary-50 text-primary-700' : isWeekend ? 'bg-red-50/50 text-red-400' : 'bg-slate-50 text-slate-600'
                        }`}
                      >
                        <div className="font-semibold">{format(d, 'E', { locale: zhCN })}</div>
                        <div className={`${isToday ? 'font-bold' : ''}`}>
                          {isToday && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500 mr-1 align-middle" />}
                          {format(d, 'd')}
                        </div>
                        <div className="text-[10px] text-slate-400">{format(d, 'M/d')}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {students.map((student, si) => (
                  <tr key={student.id} className="group hover:bg-slate-50/30 transition-colors">
                    {/* 左侧固定姓名列 */}
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/30 border-b border-r border-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                      {student.name}
                    </td>

                    {/* 日期单元格 */}
                    {dates.map((date, di) => {
                      const dateStr = format(date, 'yyyy-MM-dd')
                      const key = getCellKey(student.id, dateStr)
                      const cell = cellMap[key]
                      const isSelected = isInSelection(si, di)
                      const isTodayCell = isSameDay(date, new Date())

                      return (
                        <td
                          key={di}
                          onMouseDown={() => handleCellMouseDown(si, di)}
                          onMouseEnter={() => handleCellMouseEnter(si, di)}
                          onDoubleClick={() => openCellEditor(si, di)}
                          className={`border-b border-r border-slate-100 px-0.5 py-0.5 align-top cursor-pointer relative transition-colors ${
                            isSelected ? 'bg-primary-100 ring-2 ring-primary-300 ring-inset' :
                            isTodayCell ? 'bg-blue-50/30' :
                            ''
                          } ${activePeriod.status === 'draft' ? 'hover:bg-slate-100' : 'cursor-default'}`}
                        >
                          {cell ? (
                            <div
                              className="p-1 rounded text-center min-h-[42px] flex flex-col justify-center gap-0.5"
                              style={{
                                backgroundColor: getShiftColor(cell.shiftName || '', cell.color) + '18',
                                borderLeft: `3px solid ${getShiftColor(cell.shiftName || '', cell.color)}`,
                                fontSize: '11px',
                              }}
                            >
                              <span className="font-medium truncate">{cell.shiftName}</span>
                              {cell.teacherName && (
                                <span className="text-slate-500 truncate scale-90 origin-left">
                                  <UserCheck className="w-2.5 h-2.5 inline mr-0.5" />
                                  {cell.teacherName}
                                </span>
                              )}
                            </div>
                          ) : activePeriod.status === 'draft' ? (
                            <div className="min-h-[42px] flex items-center justify-center text-slate-300 hover:text-slate-400 text-xs">
                              双击编辑
                            </div>
                          ) : (
                            <div className="min-h-[42px]" />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 表格底部提示 */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-4">
            {activePeriod.status === 'draft' && (
              <>
                <span><strong>提示：</strong>点击拖拽选择区域 → 点击下方工具栏设置班次</span>
                <span>|</span>
                <span>双击单元格快速编辑</span>
                <span>|</span>
                <span>复制 → 选中目标区域 → 粘贴</span>
              </>
            )}
            {activePeriod.status !== 'draft' && (
              <span>当前状态为「{SCHEDULE_STATUS_LABELS[activePeriod.status]}」{activePeriod.status === 'draft' ? '' : '，不可编辑'}</span>
            )}
          </div>
        </div>
      ) : activePeriod ? (
        <div className="card text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-400">该科室暂无学生数据，请先添加学生</p>
        </div>
      ) : selectedDept ? (
        <div className="card text-center py-12">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">请选择或新建一个排班期</p>
          <p className="text-sm text-slate-400 mt-1">选择排班期后即可进行排班操作</p>
        </div>
      ) : (
        <div className="card text-center py-12">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">请先选择一个科室</p>
          <p className="text-sm text-slate-400 mt-1">选择科室后将显示对应的排班数据</p>
        </div>
      )}

      {/* ====== 选区操作栏（浮动） ====== */}
      {selectionStart && selectionEnd && activePeriod?.status === 'draft' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white shadow-xl border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 z-50 animate-slide-up">
          <GripVertical className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-600">
            已选 {Math.abs(selectionEnd.studentIdx - selectionStart.studentIdx) + 1} 行 ×
            {Math.abs(selectionEnd.dateIdx - selectionStart.dateIdx) + 1} 列
          </span>
          <div className="h-4 w-px bg-slate-200" />

          {/* 快速班次选择 */}
          <select
            onChange={e => {
              if (e.target.value) {
                handleFillSelection(e.target.value, null)
                ;(e.target as HTMLSelectElement).value = ''
              }
            }}
            className="input-base text-sm w-[120px]"
            defaultValue=""
          >
            <option value="">选择班次...</option>
            {shifts.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            onChange={e => {
              if (e.target.value) {
                handleFillSelection(null, e.target.value)
                ;(e.target as HTMLSelectElement).value = ''
              }
            }}
            className="input-base text-sm w-[120px]"
            defaultValue=""
          >
            <option value="">选择老师...</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <div className="h-4 w-px bg-slate-200" />
          <button
            onClick={() => {
              handleFillSelection(null, null)
            }}
            className="text-sm px-2 py-1 text-red-500 hover:bg-red-50 rounded-md cursor-pointer"
          >
            <Trash2 className="w-4 h-4 inline mr-1" />清除
          </button>
        </div>
      )}

      {/* ====== 单元格编辑弹窗 ====== */}
      {cellModal && activePeriod?.status === 'draft' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setCellModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-800">编辑排班</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {cellModal.student.name} · {cellModal.dateStr}
                </p>
              </div>
              <button onClick={() => setCellModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <CellEditorForm
              shifts={shifts}
              teachers={teachers}
              currentCell={
                cellMap[getCellKey(cellModal.student.id, cellModal.dateStr)] || null
              }
              onSave={(shiftId, teacherId) =>
                handleSaveCell(cellModal.student.id, cellModal.dateStr, shiftId, teacherId)
              }
              onCancel={() => setCellModal(null)}
            />
          </div>
        </div>
      )}

      {/* ====== 新建排班期弹窗 ====== */}
      {periodModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPeriodModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">新建排班期</h3>
              <button onClick={() => setPeriodModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={e => { e.preventDefault(); createPeriod() }} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  月份
                </label>
                <select
                  value={newPeriodMonth}
                  onChange={e => setNewPeriodMonth(Number(e.target.value))}
                  className="input-base"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}月</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setPeriodModal(false)} className="btn-secondary flex-1">取消</button>
                <button type="submit" className="btn-primary flex-1">创建</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== 状态流转确认弹窗 ====== */}
      {statusAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-scale-in">
            <div className="p-5 text-center space-y-4">
              <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${
                statusAction === 'publish' ? 'bg-blue-50' : 'bg-amber-50'
              }`}>
                {statusAction === 'publish'
                  ? <FileEdit className="w-6 h-6 text-blue-500" />
                  : <Send className="w-6 h-6 text-amber-500" />
                }
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">
                  确认{statusAction === 'publish' ? '发布' : '提交存档'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {statusAction === 'publish'
                    ? '发布后所有人将可以看到该排班，但仍可编辑'
                    : '提交后将进入待存档状态，需管理员审核'
                  }
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStatusAction(null)} className="btn-secondary flex-1">取消</button>
                <button onClick={handleStatusChange} className="btn-primary flex-1">
                  确认{statusAction === 'publish' ? '发布' : '提交'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ====== 子组件：单元格编辑表单 ======
function CellEditorForm({
  shifts, teachers, currentCell, onSave, onCancel,
}: {
  shifts: Shift[]
  teachers: Teacher[]
  currentCell: CellData | null
  onSave: (shiftId: string | null, teacherId: string | null) => void
  onCancel: () => void
}) {
  const [shiftId, setShiftId] = useState<string>(currentCell?.shiftId || '')
  const [teacherId, setTeacherId] = useState<string>(currentCell?.teacherId || '')

  return (
    <div className="p-5 space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1.5">
          <Clock className="w-3.5 h-3.5 inline mr-1" />班次
        </label>
        <select value={shiftId} onChange={e => setShiftId(e.target.value)} className="input-base">
          <option value="">-- 无 --</option>
          {shifts.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1.5">
          <UserCheck className="w-3.5 h-3.5 inline mr-1" />带教老师
        </label>
        <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className="input-base">
          <option value="">-- 无 --</option>
          {teachers.map(t => (
            <option key={t.id} value={t.id}>{t.name}{t.title ? `(${t.title})` : ''}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">取消</button>
        <button type="button" onClick={() => onSave(shiftId || null, teacherId || null)} className="btn-primary flex-1">
          确定
        </button>
      </div>
    </div>
  )
}
