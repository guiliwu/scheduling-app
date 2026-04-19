import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { SchedulePeriod, ScheduleEntry, ScheduleStatus, SCHEDULE_STATUS_LABELS } from '../types'
import {
  format, parseISO,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  ClipboardCheck, CheckCircle2, XCircle, Eye, FileText,
  CalendarDays, Building2, ChevronRight, Search,
} from 'lucide-react'

export default function ReviewPage() {
  const { profile } = useAuth()
  const [periods, setPeriods] = useState<SchedulePeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<SchedulePeriod | null>(null)
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [reviewNote, setReviewNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 加载待审核的排班期
  const fetchPendingPeriods = async () => {
    // 分管理员、总管理员、超级管理员可以看到 pending_archive 状态的排班
    let query = supabase
      .from('schedule_periods')
      .select('*, department(*)')
      .in('status', ['pending_archive'])
      .order('submitted_at', { ascending: false })

    const { data } = await query
    setPeriods(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchPendingPeriods()
  }, [])

  // 查看排班详情
  const viewDetail = async (period: SchedulePeriod) => {
    setSelectedPeriod(period)
    const { data } = await supabase
      .from('schedule_entries')
      .select('*, student(*), shift(*), teacher(*)')
      .eq('period_id', period.id)
      .order('schedule_date')
    setEntries(data || [])
  }

  // 审核通过
  const handleApprove = async (period: SchedulePeriod) => {
    if (!window.confirm(`确认审核通过「${period.department?.name} ${period.year}年${period.month}月」的排班？`)) return
    setSubmitting(true)

    const { error } = await supabase
      .from('schedule_periods')
      .update({
        status: 'archived',
        reviewed_at: new Date().toISOString(),
        reviewed_by: profile?.id,
        review_note: reviewNote || undefined,
      })
      .eq('id', period.id)

    if (error) { toast.error(error.message); setSubmitting(false); return }
    toast.success('已通过审核，排班已存档')
    setPeriods(prev => prev.filter(p => p.id !== period.id))
    setSelectedPeriod(null)
    setEntries([])
    setReviewNote('')
    setSubmitting(false)
  }

  // 审核驳回（退回草稿）
  const handleReject = async (period: SchedulePeriod) => {
    if (window.confirm(`确认驳回该排班？驳回后将退回草稿状态，需重新编辑后再次提交。`)) return
    const note = prompt('请输入驳回原因（选填）：')
    if (note === null) return

    setSubmitting(true)
    const { error } = await supabase
      .from('schedule_periods')
      .update({
        status: 'draft',
        reviewed_at: new Date().toISOString(),
        reviewed_by: profile?.id,
        review_note: note || '未说明原因',
      })
      .eq('id', period.id)

    if (error) { toast.error(error.message); setSubmitting(false); return }
    toast.success('已驳回并退回草稿状态')
    setPeriods(prev => prev.filter(p => p.id !== period.id))
    setSelectedPeriod(null)
    setEntries([])
    setReviewNote('')
    setSubmitting(false)
  }

  // ====== 渲染 ======
  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">排班审核</h1>
        <p className="text-sm text-slate-500 mt-0.5">审核待存档的排班方案</p>
      </div>

      {!selectedPeriod ? (
        /* ========== 待审核列表 ========== */
        <>
          {periods.length === 0 ? (
            <div className="card text-center py-16">
              <ClipboardCheck className="w-14 h-14 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 font-medium">暂无待审核的排班</p>
              <p className="text-sm text-slate-400 mt-1">提交存档的排班会出现在这里</p>
            </div>
          ) : (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">共 {periods.length} 条待审记录</span>
              </div>
              <div className="space-y-3">
                {periods.map(period => (
                  <div
                    key={period.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-primary-200 hover:bg-primary-50/30 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      {/* 科室图标 */}
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                        <Building2 className="w-5 h-5 text-blue-500" />
                      </div>

                      {/* 基本信息 */}
                      <div>
                        <h3 className="font-semibold text-slate-800 text-sm">
                          {period.department?.name || '未知科室'}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span><CalendarDays className="w-3 h-3 inline mr-0.5" />{period.year}年{period.month}月</span>
                          <span>提交于 {period.submitted_at ? format(parseISO(period.submitted_at), 'M月d日 HH:mm') : '-'}</span>
                        </div>
                      </div>
                    </div>

                    {/* 右侧操作 */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => viewDetail(period)}
                        className="btn-secondary text-sm flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />查看详情
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ========== 排班详情 + 审核 ========== */
        <div className="space-y-4">
          {/* 返回按钮 */}
          <button
            onClick={() => { setSelectedPeriod(null); setEntries([]); setReviewNote('') }}
            className="text-sm text-slate-500 hover:text-primary-600 flex items-center gap-1 cursor-pointer mb-2"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />返回列表
          </button>

          {/* 头部信息卡片 */}
          <div className="card">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    {selectedPeriod.department?.name} - {selectedPeriod.year}年{selectedPeriod.month}月排班
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500">
                    <span>提交时间：{selectedPeriod.submitted_at ? format(parseISO(selectedPeriod.submitted_at), 'yyyy-MM-dd HH:mm:ss') : '-'}</span>
                    <span>条目数：<strong>{entries.length}</strong></span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700`}>
                      待存档
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 排班数据预览 */}
          {entries.length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4" />排班明细 ({entries.length} 条记录)
                </h3>
              </div>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto -mx-6 px-6">
                <table className="w-full min-w-[600px]">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <th className="pb-3 pr-4">日期</th>
                      <th className="pb-3 pr-4">学生</th>
                      <th className="pb-3 pr-4">班次</th>
                      <th className="pb-3 pr-4">带教老师</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {entries.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50/50 transition-colors text-sm">
                        <td className="py-2.5 pr-4 whitespace-nowrap font-mono text-xs">
                          {format(parseISO(e.schedule_date), 'MM-dd EEE', { locale: zhCN })}
                        </td>
                        <td className="py-2.5 pr-4">{e.student?.name}</td>
                        <td className="py-2.5 pr-4">
                          {e.shift?.name && (
                            <span
                              className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: e.shift.color ? e.shift.color + '18' : '#f1f5f9',
                                color: e.shift.color || '#475569',
                                borderLeft: `3px solid ${e.shift.color || '#94a3b8'}`,
                              }}
                            >
                              {e.shift.name}
                            </span>
                          )}
                          {!e.shift?.name && <span className="text-slate-400 text-xs">--</span>}
                        </td>
                        <td className="py-2.5 pr-4 text-slate-500">{e.teacher?.name || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 审核操作区 */}
          <div className="card">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">审核意见</h3>
            <textarea
              value={reviewNote}
              onChange={e => setReviewNote(e.target.value)}
              placeholder="请输入审核意见（选填）..."
              rows={3}
              className="input-base resize-none"
            />

            <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => handleReject(selectedPeriod)}
                disabled={submitting}
                className="btn-secondary flex items-center gap-2 text-red-600 hover:bg-red-50 hover:border-red-200"
              >
                <XCircle className="w-4 h-4" />驳回
              </button>
              <button
                onClick={() => handleApprove(selectedPeriod)}
                disabled={submitting}
                className="btn-primary flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {submitting ? '处理中...' : '通过并存档'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
