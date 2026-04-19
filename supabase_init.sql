-- ================================================================
-- 学生排班管理系统 - Supabase 数据库初始化脚本
-- 请在 Supabase SQL Editor 中依次执行以下各部分
-- ================================================================

-- ================================================================
-- Part 1: 基础表创建
-- ================================================================

-- 科室表（两级结构）
CREATE TABLE IF NOT EXISTS departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('first', 'second')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 班次表
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_holiday BOOLEAN DEFAULT FALSE,
  is_rest BOOLEAN DEFAULT FALSE,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 老师表
CREATE TABLE IF NOT EXISTS teachers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  title TEXT,
  teacher_type TEXT NOT NULL CHECK (teacher_type IN ('head_teacher', 'teaching_teacher', 'class_teacher')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 学生表
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  education TEXT NOT NULL DEFAULT '本科',
  student_type TEXT NOT NULL CHECK (student_type IN ('intern', 'graduate', 'advanced', 'other')),
  school_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 老师-科室关联表（老师可跨科室）
CREATE TABLE IF NOT EXISTS teacher_department_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, department_id)
);

-- 用户档案表（关联 auth.users）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'general_admin', 'sub_admin', 'admin', 'teacher', 'student')),
  employee_id TEXT,
  student_id TEXT,
  name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id),
  managed_department_ids UUID[] DEFAULT '{}',
  must_change_password BOOLEAN DEFAULT TRUE,
  teacher_id UUID REFERENCES teachers(id),
  student_ref_id UUID REFERENCES students(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 排班周期表（按月/周）
CREATE TABLE IF NOT EXISTS schedule_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'pending_archive', 'archived')),
  created_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, year, month)
);

-- 排班明细表（每个学生每天的排班）
CREATE TABLE IF NOT EXISTS schedule_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id UUID NOT NULL REFERENCES schedule_periods(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  shift_id UUID REFERENCES shifts(id),
  teacher_id UUID REFERENCES teachers(id),
  department_id UUID NOT NULL REFERENCES departments(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, schedule_date)  -- 防冲突：同一学生同一天只能有一条排班
);

-- ================================================================
-- Part 2: 索引优化
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_schedule_entries_period ON schedule_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_student ON schedule_entries(student_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_date ON schedule_entries(schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedule_periods_dept ON schedule_periods(department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_employee ON profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_profiles_student ON profiles(student_id);

-- ================================================================
-- Part 3: RLS 行级安全策略
-- ================================================================

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_department_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;

-- 辅助函数：获取当前用户角色
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 辅助函数：获取当前用户科室
CREATE OR REPLACE FUNCTION get_my_department_id()
RETURNS UUID AS $$
  SELECT department_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 辅助函数：获取分管理员管辖的科室IDs
CREATE OR REPLACE FUNCTION get_my_managed_departments()
RETURNS UUID[] AS $$
  SELECT COALESCE(managed_department_ids, '{}') FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- departments 表策略：所有登录用户可读，管理员及以上可写
CREATE POLICY "departments_read" ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_write" ON departments FOR ALL TO authenticated
  USING (get_my_role() IN ('super_admin', 'general_admin', 'sub_admin', 'admin'))
  WITH CHECK (get_my_role() IN ('super_admin', 'general_admin'));

-- shifts 表策略：所有登录用户可读，管理员及以上可写
CREATE POLICY "shifts_read" ON shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "shifts_write" ON shifts FOR ALL TO authenticated
  USING (get_my_role() IN ('super_admin', 'general_admin'))
  WITH CHECK (get_my_role() IN ('super_admin', 'general_admin'));

-- teachers 表策略
CREATE POLICY "teachers_read" ON teachers FOR SELECT TO authenticated USING (true);
CREATE POLICY "teachers_write" ON teachers FOR ALL TO authenticated
  USING (get_my_role() IN ('super_admin', 'general_admin'))
  WITH CHECK (get_my_role() IN ('super_admin', 'general_admin'));

-- students 表策略
CREATE POLICY "students_read_all" ON students FOR SELECT TO authenticated
  USING (get_my_role() IN ('super_admin', 'general_admin', 'sub_admin', 'admin', 'teacher'));
CREATE POLICY "students_read_own" ON students FOR SELECT TO authenticated
  USING (id = (SELECT student_ref_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "students_write" ON students FOR ALL TO authenticated
  USING (get_my_role() IN ('super_admin', 'general_admin'))
  WITH CHECK (get_my_role() IN ('super_admin', 'general_admin'));

-- teacher_department_assignments 表策略
CREATE POLICY "tda_read" ON teacher_department_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "tda_write" ON teacher_department_assignments FOR ALL TO authenticated
  USING (get_my_role() IN ('super_admin', 'general_admin'))
  WITH CHECK (get_my_role() IN ('super_admin', 'general_admin'));

-- profiles 表策略
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "profiles_read_admin" ON profiles FOR SELECT TO authenticated
  USING (get_my_role() IN ('super_admin', 'general_admin'));
CREATE POLICY "profiles_read_dept_admin" ON profiles FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin' AND department_id = get_my_department_id()
    OR get_my_role() = 'sub_admin' AND department_id = ANY(get_my_managed_departments())
    OR get_my_role() = 'teacher' AND department_id = get_my_department_id()
  );
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE TO authenticated
  USING (get_my_role() IN ('super_admin', 'general_admin'));
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE TO authenticated
  USING (get_my_role() = 'super_admin');

-- schedule_periods 表策略
CREATE POLICY "periods_read_super_general" ON schedule_periods FOR SELECT TO authenticated
  USING (get_my_role() IN ('super_admin', 'general_admin'));
CREATE POLICY "periods_read_sub_admin" ON schedule_periods FOR SELECT TO authenticated
  USING (get_my_role() = 'sub_admin' AND department_id = ANY(get_my_managed_departments()));
CREATE POLICY "periods_read_admin_teacher" ON schedule_periods FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('admin', 'teacher') AND department_id = get_my_department_id()
  );
CREATE POLICY "periods_write_admin" ON schedule_periods FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'general_admin', 'super_admin')
    AND (get_my_role() IN ('general_admin', 'super_admin') OR department_id = get_my_department_id())
  );
CREATE POLICY "periods_update" ON schedule_periods FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() = 'general_admin')
    OR (get_my_role() = 'sub_admin' AND department_id = ANY(get_my_managed_departments()))
    OR (get_my_role() = 'admin' AND department_id = get_my_department_id() AND status IN ('draft','published'))
  );

-- schedule_entries 表策略
CREATE POLICY "entries_read_student" ON schedule_entries FOR SELECT TO authenticated
  USING (
    get_my_role() = 'student'
    AND student_id = (SELECT student_ref_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    AND EXISTS (SELECT 1 FROM schedule_periods WHERE id = period_id AND status IN ('published','archived'))
  );
CREATE POLICY "entries_read_teacher" ON schedule_entries FOR SELECT TO authenticated
  USING (
    get_my_role() = 'teacher'
    AND department_id = get_my_department_id()
    AND EXISTS (SELECT 1 FROM schedule_periods WHERE id = period_id AND status IN ('published','archived'))
  );
CREATE POLICY "entries_read_admin" ON schedule_periods FOR SELECT TO authenticated
  USING (get_my_role() = 'admin' AND department_id = get_my_department_id());
CREATE POLICY "entries_read_higher" ON schedule_entries FOR SELECT TO authenticated
  USING (get_my_role() IN ('super_admin', 'general_admin', 'sub_admin', 'admin'));
CREATE POLICY "entries_write_admin" ON schedule_entries FOR ALL TO authenticated
  USING (
    get_my_role() IN ('admin', 'general_admin', 'super_admin')
    AND (get_my_role() IN ('general_admin', 'super_admin') OR department_id = get_my_department_id())
    AND EXISTS (SELECT 1 FROM schedule_periods WHERE id = period_id AND status IN ('draft', 'published'))
  )
  WITH CHECK (
    get_my_role() IN ('admin', 'general_admin', 'super_admin')
  );

-- ================================================================
-- Part 4: 插入默认数据
-- ================================================================

-- 默认班次
INSERT INTO shifts (name, is_holiday, is_rest, color) VALUES
  ('A', false, false, '#3B82F6'),
  ('P', false, false, '#8B5CF6'),
  ('N', false, false, '#1D4ED8'),
  ('D', false, false, '#0891B2'),
  ('办', false, false, '#64748B'),
  ('休', false, true, '#94A3B8'),
  ('停', false, true, '#94A3B8'),
  ('年假', true, false, '#F59E0B'),
  ('事假', true, false, '#F97316'),
  ('病假', true, false, '#EF4444')
ON CONFLICT (name) DO NOTHING;

-- ================================================================
-- Part 5: 触发器 - 自动计算班次属性
-- ================================================================
CREATE OR REPLACE FUNCTION update_shift_flags()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_holiday := NEW.name LIKE '%假%';
  NEW.is_rest := NEW.name IN ('停', '休') OR NEW.name LIKE '%休%' AND NEW.name NOT LIKE '%假%';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shift_flags_trigger
  BEFORE INSERT OR UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_shift_flags();
