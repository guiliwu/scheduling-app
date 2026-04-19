import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ScheduleEntry, SchedulePeriod, Department, Shift, SCHEDULE_STATUS_LABELS } from '../types'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  BarChart3, Building2, Users, UserCheck, Download, CalendarDays,
  ChevronDown, Filter, TrendingUp, FileSpreadsheet,
} from 'lucide-react'

type StatTab = 'department' | 'teacher' | 'student'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

export default function StatisticsPage() {
  const [activeTab, setActiveTab] = useState<StatTab>('department')
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDept, setSelectedDept] = useState<string>('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [periods, setPeriods] = useState<SchedulePeriod[]>([])

  // 加载科室列表
  useEffect(() => {
    const fetchDepts = async () => {
      const { data } = await supabase.from('departments').select('*').order('name')
      setDepartments(data || [])
    }
    fetchDepts()
  }, [])

  // 当筛选条件变化时加载数据
  useEffect(() => {
    if (!selectedDept) return
    loadStatistics()
  }, [selectedDept, year, month])

  const loadStatistics = async () => {
    setLoading(true)

    // 获取符合条件的排班期
    let periodQuery = supabase
      .from('schedule_periods')
      .select('id')
      .eq('department_id', selectedDept)
      .eq('year', year)
      .in('status', ['published', 'pending_archive', 'archived'])

    if (month) periodQuery = periodQuery.eq('month', month)

    const { data: periodData } = await periodQuery
    if (!periodData || periodData.length === 0) {
      setEntries([])
      setPeriods([])
      setLoading(false)
      return
    }

    setPeriods(periodData.map(p => p.id))

    // 获取所有排班条目
    const { data: entryData } = await supabase
      .from('schedule_entries')
      .select('*, student(*), shift(*), teacher(*)')
      .in('period_id', periodData.map(p => p.id))
      .order('schedule_date')

    setEntries(entryData || [])
    setLoading(false)
  }

  // ====== 统计计算 ======

  /** 按科室统计 */
  const deptStats = (() => {
    // 统计每个学生在此期间的带教天数、各班次分布
    const studentMap = new Map<string, { name: string; days: number; shifts: Record<string, number>; teachers: Set<string> }>()
    for (const e of entries) {
      if (!e.student) continue
      const sid = e.student_id
      if (!studentMap.has(sid)) {
        studentMap.set(sid, {
          name: e.student.name,
          days: 0,
          shifts: {},
          teachers: new Set(),
        })
      }
      const s = studentMap.get(sid)!
      s.days++
      if (e.shift) {
        s.shifts[e.shift.name] = (s.shifts[e.shift.name] || 0) + 1
      }
      if (e.teacher_id) s.teachers.add(e.teacher_name || e.teacher?.name || '')
    }

    return Array.from(studentMap.values()).map(s => ({
      ...s,
      teacherCount: s.teachers.size,
      teacherList: Array.from(s.teachers).join(', '),
    }))
  })()

  /** 按老师统计 */
  const teacherStats = (() => {
    const map = new Map<string, { name: string; totalDays: number; students: Set<string> }>()
    for (const e of entries) {
      if (!e.teacher_id) continue
      const tid = e.teacher_id
      if (!map.has(tid)) {
        map.set(tid, {
          name: e.teacher?.name || e.teacherName || '未知老师',
          totalDays: 0,
          students: new Set(),
        })
      }
      const t = map.get(tid)!
      t.totalDays++
      if (e.student) t.students.add(e.student.name)
    }
    return Array.from(map.values()).map(t => ({
      ...t,
      studentCount: t.students.size,
      studentList: Array.from(t.students).join(', '),
    })).sort((a, b) => b.totalDays - a.totalDays)
  })()

  /** 按学生统计 */
  const studentStats = (() => {
    const map = new Map<string, { name: string; workDays: number; holidayDays: number; restDays: number; emptyDays: number }>()
    for (const e of entries) {
      if (!e.student) continue
      const sid = e.student_id
      if (!map.has(sid)) {
        map.set(sid, {
          name: e.student.name,
          workDays: 0,
          holidayDays: 0,
          restDays: 0,
          emptyDays: 0,
        })
      }
      const s = map.get(sid)!
      if (e.shift) {
        if (e.shift.is_holiday) s.holidayDays++
        else if (e.shift.is_rest) s.restDays++
        else s.workDays++
      } else {
        s.emptyDays++
      }
    }
    return Array.from(map.values()).sort((a, b) => b.workDays - a.workDays)
  })()

  // ====== 图表数据 ======
  const deptChartData = teacherStats.slice(0, 10).map(t => ({
    name: t.name.length > 4 ? t.name.substring(0, 4) + '..' : t.name,
    fullName: t.name,
    带教天数: t.totalDays,
    带教学生数: t.studentCount,
  }))

  const shiftDistribution = (() => {
    const map = new Map<string, number>()
    for (const e of entries) {
      if (!e.shift) continue
      map.set(e.shift.name, (map.get(e.shift.name) || 0) + 1)
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  })()

  // ====== 导出功能 ======
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new()

    if (activeTab === 'department' || activeTab === 'all') {
      const wsData = [
        ['学生姓名', '带教天数', '带教老师数', '带教老师名单'],
        ...deptStats.map(s => [
          s.name, s.days, s.teacherCount, s.teacherList,
        ]),
      ]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      XLSX.utils.book_append_sheet(wb, ws, '按学生统计')
    }

    if (activeTab === 'teacher' || activeTab === 'all') {
      const wsData = [
        ['老师姓名', '带教天数', '带教学生数', '学生名单'],
        ...teacherStats.map(t => [
          t.name, t.totalDays, t.studentCount, t.studentList,
        ]),
      ]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      XLSX.utils.book_append_sheet(wb, ws, '按老师统计')
    }

    if (activeTab === 'student' || activeTab === 'all') {
      const wsData = [
        ['学生姓名', '上班天数', '休假天数', '休息天数', '空缺天数'],
        ...studentStats.map(s => [
          s.name, s.workDays, s.holidayDays, s.restDays, s.emptyDays,
        ]),
      ]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      XLSX.utils.book_append_sheet(wb, ws, '按学生统计')
    }

    const fileName = selectedDept
      ? `${departments.find(d => d.id === selectedDept)?.name || '排班'}_${year}${month ? `${String(month).padStart(2, '0')}` : ''}_统计.xlsx`
      : `排班统计_${year}.xlsx`

    XLSX.writeFile(wb, fileName)
    toast.success(`已导出 ${fileName}`)
  }

  // ====== Tab 配置 ======
  const tabs: { key: StatTab; label: string; icon: React.ReactNode }[] = [
    { key: 'department', label: '按科室统计', icon: <Building2 className="w-4 h-4" /> },
    { key: 'teacher', label: '按老师统计', icon: <UserCheck className="w-4 h-4" /> },
    { key: 'student', label: '按学生统计', icon: <Users className="w-4 h-4" /> },
  ]

  // ====== 渲染 ======
  return (
    <div className="animate-fade-in">
      {/* 头部 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">统计报表</h1>
        <p className="text-sm text-slate-500 mt-0.5">多维度查看排班统计数据，支持导出 Excel</p>
      </div>

      {/* 筛选区 */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">科室</label>
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="input-base w-[180px]"
            >
              <option value="">-- 全部科室 --</option>
              {departments.filter(d => d.type === 'second').map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">年份</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="input-base w-[100px]">
              {[2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">月份（可选）</label>
            <select value={month ?? ''} onChange={e => setMonth(e.target.value ? Number(e.target.value) : null)} className="input-base w-[120px]">
              <option value="">全年</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}月</option>
              ))}
            </select>
          </div>
          <button onClick={loadStatistics} className="btn-secondary flex items-center gap-1.5">
            <Filter className="w-4 h-4" />查询
          </button>

          <div className="ml-auto">
            <button onClick={exportToExcel} disabled={entries.length === 0}
              className="btn-primary flex items-center gap-1.5 disabled:opacity-50">
              <Download className="w-4 h-4" />导出Excel
            </button>
          </div>
        </div>
      </div>

      {!selectedDept ? (
        <div className="card text-center py-16">
          <BarChart3 className="w-14 h-14 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 font-medium">请选择一个科室开始统计</p>
        </div>
      ) : loading ? (
        <div className="card flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="card text-center py-16">
          <FileSpreadsheet className="w-14 h-14 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 font-medium">暂无符合条件的数据</p>
          <p className="text-sm text-slate-400 mt-1">请尝试调整筛选条件</p>
        </div>
      ) : (
        <>
          {/* Tab 切换 */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit mb-6">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* ========== 按科室/学生统计视图 ========== */}
          {(activeTab === 'department' || activeTab === 'all') && (
            <div className="space-y-6">
              {/* 图表：老师带教情况柱状图 */}
              {teacherStats.length > 0 && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary-500" />
                    老师带教情况 Top {Math.min(teacherStats.length, 10)}
                  </h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deptChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" fontSize={11} tickLine={false} />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip
                          formatter={(value: any, name: string) => [value, name]}
                          labelFormatter={(label: string) => {
                            const item = deptChartData.find(d => d.name === label)
                            return item?.fullName || label
                          }}
                        />
                        <Legend />
                        <Bar dataKey="带教天数" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={28} />
                        <Bar dataKey="带教学生数" fill="#10B981" radius={[4, 4, 0, 0]} barSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 班次分布饼图 */}
              {shiftDistribution.length > 0 && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">班次分布</h3>
                  <div className="flex items-center gap-6">
                    <div className="h-[220px] w-[220px] flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={shiftDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                            nameKey="name"
                          >
                            {shiftDistribution.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {shiftDistribution.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-2 text-sm">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="text-slate-600">{item.name}</span>
                          <span className="font-medium text-slate-700">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 学生明细表 */}
              <div className="card overflow-hidden p-0">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">
                    学生带教详情 ({deptStats.length} 名学生)
                  </h3>
                </div>
                <div className="overflow-x-auto -mx-6 px-6 max-h-[400px] overflow-y-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="sticky top-0 z-10 bg-white">
                      <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        <th className="pb-3 pr-4">学生姓名</th>
                        <th className="pb-3 pr-4 text-right">带教天数</th>
                        <th className="pb-3 pr-4 text-right">带教老师数</th>
                        <th className="pb-3">带教老师名单</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {deptStats.map((s, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors text-sm">
                          <td className="py-2.5 pr-4 font-medium">{s.name}</td>
                          <td className="py-2.5 pr-4 text-right font-mono font-semibold text-primary-600">{s.days}</td>
                          <td className="py-2.5 pr-4 text-right">{s.teacherCount}</td>
                          <td className="py-2.5 text-slate-500 text-xs max-w-[300px] truncate">{s.teacherList}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========== 按老师统计视图 ========== */}
          {(activeTab === 'teacher' || activeTab === 'all') && (
            <div className="space-y-6">
              <div className="card overflow-hidden p-0">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-semibold text-slate-700">
                    老师带教详情 ({teacherStats.length} 位老师)
                  </h3>
                </div>
                <div className="overflow-x-auto -mx-6 px-6 max-h-[400px] overflow-y-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="sticky top-0 z-10 bg-white">
                      <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        <th className="pb-3 pr-4">老师姓名</th>
                        <th className="pb-3 pr-4 text-right">带教天数</th>
                        <th className="pb-3 pr-4 text-right">带教学生数</th>
                        <th className="pb-3">学生名单</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {teacherStats.map((t, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors text-sm">
                          <td className="py-2.5 pr-4 font-medium">{t.name}</td>
                          <td className="py-2.5 pr-4 text-right font-mono font-semibold text-primary-600">{t.totalDays}</td>
                          <td className="py-2.5 pr-4 text-right">{t.studentCount}</td>
                          <td className="py-2.5 text-slate-500 text-xs max-w-[300px] truncate">{t.studentList}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========== 按学生统计视图 ========== */}
          {(activeTab === 'student' || activeTab === 'all') && (
            <div className="space-y-6">
              {/* 学生工休统计图表 */}
              <div className="card">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">学生工休统计</h3>
                <div className="overflow-x-auto -mx-6 px-6 max-h-[400px] overflow-y-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="sticky top-0 z-10 bg-white">
                      <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        <th className="pb-3 pr-4">学生姓名</th>
                        <th className="pb-3 pr-4 text-right">
                          <span className="inline-block w-2 h-2 rounded bg-blue-500 mr-1 align-middle" />
                          上班
                        </th>
                        <th className="pb-3 pr-4 text-right">
                          <span className="inline-block w-2 h-2 rounded bg-red-400 mr-1 align-middle" />
                          休假
                        </th>
                        <th className="pb-3 pr-4 text-right">
                          <span className="inline-block w-2 h-2 rounded bg-slate-400 mr-1 align-middle" />
                          休息
                        </th>
                        <th className="pb-3 pr-4 text-right">
                          <span className="inline-block w-2 h-2 rounded bg-gray-200 mr-1 align-middle" />
                          空缺
                        </th>
                        <th className="pb-3 text-right">总计</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {studentStats.map((s, i) => {
                        const total = s.workDays + s.holidayDays + s.restDays + s.emptyDays
                        return (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors text-sm">
                            <td className="py-2.5 pr-4 font-medium">{s.name}</td>
                            <td className="py-2.5 pr-4 text-right font-mono text-blue-600 font-semibold">{s.workDays}</td>
                            <td className="py-2.5 pr-4 text-right font-mono text-red-500">{s.holidayDays}</td>
                            <td className="py-2.5 pr-4 text-right font-mono text-slate-500">{s.restDays}</td>
                            <td className="py-2.5 pr-4 text-right font-mono text-gray-400">{s.emptyDays}</td>
                            <td className="py-2.5 pr-4 text-right font-mono font-bold text-slate-700">{total}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
