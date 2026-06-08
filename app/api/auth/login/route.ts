import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createSessionCookie } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  // Admin must sign in via /admin/login (uses Supabase Auth)
  if (email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Admins must sign in at the admin login page' }, { status: 403 })
  }

  const supabase = createAdminClient()

  const { data: student } = await supabase
    .from('students')
    .select('id, email, has_logged_in, has_voted')
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (!student) {
    return NextResponse.json({ error: 'This email is not registered to vote' }, { status: 401 })
  }

  if (student.has_voted) {
    return NextResponse.json({ error: 'You have already voted' }, { status: 403 })
  }

  if (student.has_logged_in) {
    return NextResponse.json({
      error: 'You already logged in once. If you logged out before voting, you cannot re-enter. Contact your administrator.'
    }, { status: 403 })
  }

  // Mark as logged in (one-time access)
  await supabase.from('students').update({ has_logged_in: true }).eq('email', email.toLowerCase())

  // Create session cookie
  const cookie = await createSessionCookie({ email: student.email, id: student.id })
  const response = NextResponse.json({ success: true, redirect: '/vote' })
  response.headers.append('Set-Cookie', cookie)

  return response
}
