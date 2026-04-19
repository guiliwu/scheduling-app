import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Profile } from '../types'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    setProfile(data)
    return data
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (identifier: string, password: string): Promise<{ error: string | null }> => {
    // 先尝试直接以邮箱登录（超级管理员）
    let email = identifier
    let isEmailLogin = identifier.includes('@')

    if (!isEmailLogin) {
      // 查询人员表，将工号/学号转换为虚拟邮箱
      email = `${identifier}@scheduling.local`
    }

    // 尝试登录
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // 如果登录失败且不是邮箱登录，尝试自动注册
      if (!isEmailLogin) {
        return await autoRegisterAndLogin(identifier, password)
      }
      return { error: error.message }
    }

    if (data.user) {
      const prof = await fetchProfile(data.user.id)
      if (!prof) {
        return { error: '账号信息不完整，请联系管理员' }
      }
    }
    return { error: null }
  }

  const autoRegisterAndLogin = async (identifier: string, password: string): Promise<{ error: string | null }> => {
    // 查询老师表
    const { data: teacher } = await supabase
      .from('teachers')
      .select('*')
      .eq('employee_id', identifier)
      .single()

    // 查询学生表
    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('student_id', identifier)
      .single()

    if (!teacher && !student) {
      return { error: '工号/学号不存在，请联系管理员添加人员信息' }
    }

    const email = `${identifier}@scheduling.local`
    const personName = teacher?.name || student?.name || identifier

    // 注册账号
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: password || '123456',
      options: {
        data: { name: personName }
      }
    })

    if (signUpError) return { error: signUpError.message }
    if (!signUpData.user) return { error: '注册失败' }

    // 创建档案
    const role = teacher ? 'teacher' : 'student'
    const profileData = {
      user_id: signUpData.user.id,
      role,
      name: personName,
      employee_id: teacher ? identifier : undefined,
      student_id: student ? identifier : undefined,
      teacher_id: teacher?.id,
      student_ref_id: student?.id,
      must_change_password: true,
    }

    const { error: profileError } = await supabase.from('profiles').insert(profileData)
    if (profileError) return { error: profileError.message }

    // 登录
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password: password || '123456' })
    if (loginError) return { error: loginError.message }

    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
