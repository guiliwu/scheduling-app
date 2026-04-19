import { useAuth } from '../contexts/AuthContext'
import { ROLE_LABELS } from '../types'
import { Link } from 'react-router-dom'
import { Calendar, BarChart3, Users, Building2, Clock, ClipboardCheck, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const { profile } = useAuth()
  const role = profile?.role || 'student'

  const cards = [
    {
      title: '排班管理',
      desc: role === 'student' ? '查看我的排班安排' : role === 'teacher' ? '查看科室排班' : '管理科室排班',
      icon: <Calendar className="w-6 h-6" />,
      to: '/schedule',
      color: 'from-blue-500 to-blue-600',
      show: ['super_admin','general_admin','sub_admin','admin','teacher','student'],
    },
    {
      title: '排班审核',
      desc: '审核待存档的排班申请',
      icon: <ClipboardCheck className="w-6 h-6" />,
      to: '/review',
      color: 'from-violet-500 to-violet-600',
      show: ['sub_admin','general_admin','super_admin'],
    },
    {
      title: '统计报表',
      desc: '带教统计与数据导出',
      icon: <BarChart3 className="w-6 h-6" />,
      to: '/statistics',
      color: 'from-emerald-500 to-emerald-600',
      show: ['super_admin','general_admin','sub_admin','admin'],
    },
    {
      title: '科室管理',
      desc: '管理一级/二级科室',
      icon: <Building2 className="w-6 h-6" />,
      to: '/departments',
      color: 'from-orange-500 to-orange-600',
      show: ['super_admin','general_admin'],
    },
    {
      title: '人员管理',
      desc: '老师和学生信息管理',
      icon: <Users className="w-6 h-6" />,
      to: '/teachers',
      color: 'from-pink-500 to-pink-600',
      show: ['super_admin','general_admin'],
    },
    {
      title: '班次管理',
      desc: '自定义班次类型',
      icon: <Clock className="w-6 h-6" />,
      to: '/shifts',
      color: 'from-cyan-500 to-cyan-600',
      show: ['super_admin','general_admin'],
    },
  ].filter(c => c.show.includes(role))

  const greetings = ['超级管理员', '总管理员', '分管理员', '管理员'].includes(ROLE_LABELS[role])
    ? `您好，${profile?.name || ''} ${ROLE_LABELS[role]}`
    : `您好，${profile?.name || ''}`

  return (
    <div className="animate-fade-in">
      {/* 欢迎横幅 */}
      <div className="relative rounded-2xl overflow-hidden mb-6 p-6"
        style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 60%, #60a5fa 100%)' }}>
        <div className="absolute right-0 top-0 w-64 h-full opacity-10">
          <svg viewBox="0 0 200 200" className="w-full h-full" fill="white">
            <circle cx="150" cy="50" r="80" />
            <circle cx="50" cy="150" r="60" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">{greetings}！👋</h1>
        <p className="text-blue-100 text-sm">今天是 {new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <div className="mt-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
            {ROLE_LABELS[role]}
          </span>
        </div>
      </div>

      {/* 功能卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(card => (
          <Link key={card.to} to={card.to}
            className="group card hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform`}>
              {card.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 mb-0.5">{card.title}</p>
              <p className="text-sm text-slate-500">{card.desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
          </Link>
        ))}
      </div>

      {/* 快速说明 */}
      {role === 'student' && (
        <div className="mt-6 card bg-blue-50 border-blue-100">
          <h3 className="font-medium text-blue-800 mb-2">📖 使用说明</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 点击「排班管理」可查看您当前的排班安排</li>
            <li>• 可按周或按月切换查看视图</li>
            <li>• 只有「已发布」或「已存档」的排班才会显示</li>
          </ul>
        </div>
      )}
      {role === 'admin' && (
        <div className="mt-6 card bg-green-50 border-green-100">
          <h3 className="font-medium text-green-800 mb-2">📋 工作流程</h3>
          <div className="flex items-center gap-2 text-sm text-green-700 flex-wrap">
            {['创建排班（草稿）', '→ 发布排班', '→ 提交存档', '→ 等待审核通过'].map((step, i) => (
              <span key={i} className={`px-2 py-1 rounded-md ${i === 0 ? 'bg-slate-200 text-slate-700' : i === 1 ? 'bg-blue-200 text-blue-700' : i === 2 ? 'bg-yellow-200 text-yellow-700' : 'bg-green-200 text-green-700'}`}>
                {step}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
