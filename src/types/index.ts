export type UserRole = 'super_admin' | 'general_admin' | 'sub_admin' | 'admin' | 'teacher' | 'student'

export type ScheduleStatus = 'draft' | 'published' | 'pending_archive' | 'archived'

export interface Profile {
  id: string
  user_id: string
  role: UserRole
  employee_id?: string   // 工号（老师/管理员）
  student_id?: string    // 学号（学生）
  name: string
  department_id?: string
  managed_department_ids?: string[]  // 分管理员管辖的科室ID列表
  must_change_password: boolean
  created_at: string
}

export interface Department {
  id: string
  name: string
  parent_id?: string
  type: 'first' | 'second'  // 一级科室 | 二级科室
  created_at: string
  parent?: Department
  children?: Department[]
}

export interface Shift {
  id: string
  name: string
  is_holiday: boolean  // 含"假"字自动标记
  is_rest: boolean     // 班次为"停"或"休"
  color?: string
  created_at: string
}

export interface Teacher {
  id: string
  employee_id: string  // 工号（唯一）
  name: string
  title?: string       // 职称
  teacher_type: 'head_teacher' | 'teaching_teacher' | 'class_teacher'  // 总带教/带教老师/带班老师
  created_at: string
}

export interface Student {
  id: string
  student_id: string   // 学号（唯一）
  name: string
  education: string    // 学历
  student_type: 'intern' | 'graduate' | 'advanced' | 'other'  // 实习生/研究生/进修生/其他
  school_name: string  // 学校/单位名称
  created_at: string
}

export interface TeacherDepartmentAssignment {
  id: string
  teacher_id: string
  department_id: string
  start_date?: string
  end_date?: string
  teacher?: Teacher
  department?: Department
}

export interface SchedulePeriod {
  id: string
  department_id: string
  year: number
  month: number
  week?: number
  status: ScheduleStatus
  created_by: string
  submitted_at?: string
  reviewed_at?: string
  reviewed_by?: string
  review_note?: string
  created_at: string
  department?: Department
}

export interface ScheduleEntry {
  id: string
  period_id: string
  student_id: string
  schedule_date: string
  shift_id?: string
  teacher_id?: string
  department_id: string
  created_at: string
  student?: Student
  shift?: Shift
  teacher?: Teacher
  department?: Department
}

export interface AdminAccount {
  id: string
  user_id: string
  role: UserRole
  name: string
  employee_id?: string
  department_id?: string
  managed_department_ids?: string[]
  created_at: string
  department?: Department
}

export type TeacherType = Teacher['teacher_type']
export type StudentType = Student['student_type']

export const TEACHER_TYPE_LABELS: Record<TeacherType, string> = {
  head_teacher: '总带教',
  teaching_teacher: '带教老师',
  class_teacher: '带班老师',
}

export const STUDENT_TYPE_LABELS: Record<StudentType, string> = {
  intern: '实习生',
  graduate: '研究生',
  advanced: '进修生',
  other: '其他',
}

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  draft: '草稿',
  published: '已发布',
  pending_archive: '待存档',
  archived: '已存档',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: '超级管理员',
  general_admin: '总管理员',
  sub_admin: '分管理员',
  admin: '管理员',
  teacher: '老师',
  student: '学生',
}
