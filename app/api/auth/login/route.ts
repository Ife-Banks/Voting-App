import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createSessionCookie } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    let email: string
    try {
      const body = await req.json()
      email = body.email
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    email = email.toLowerCase()

    if (email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Admins must sign in at the admin login page' }, { status: 403 })
    }

    const supabase = createAdminClient()

    const { data: student, error: dbError } = await supabase
      .from('students')
      .select('id, email, has_voted')
      .eq('email', email)
      .maybeSingle()

    if (dbError) {
      return NextResponse.json({ error: 'Database error. Check that the students table exists.' }, { status: 500 })
    }

    if (!student) {
      return NextResponse.json({ error: 'This email is not registered to vote' }, { status: 401 })
    }

    if (student.has_voted) {
      return NextResponse.json({ error: 'You have already voted' }, { status: 403 })
    }

    const cookie = await createSessionCookie({ email: student.email, id: student.id })
    const response = NextResponse.json({ success: true })
    response.headers.append('Set-Cookie', cookie)
    return response
  } catch (err) {
    return NextResponse.json({ error: 'Server error: ' + (err instanceof Error ? err.message : 'unknown') }, { status: 500 })
  }
}
