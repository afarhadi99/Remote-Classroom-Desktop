import { NextResponse } from 'next/server'
import { getSession, type StudentSession, type TeacherSession, type AdminSession } from './auth'

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function getTeacher(): Promise<TeacherSession | null> {
  const s = await getSession()
  return s && s.role === 'teacher' ? s : null
}

export async function getStudent(): Promise<StudentSession | null> {
  const s = await getSession()
  return s && s.role === 'student' ? s : null
}

export async function getAdmin(): Promise<AdminSession | null> {
  const s = await getSession()
  return s && s.role === 'admin' ? s : null
}
