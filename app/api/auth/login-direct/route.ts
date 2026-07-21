import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createSessionCookie, getCookieExpiry } from '@/lib/session'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAuth, logError } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip') ?? 'unknown'

    const rl = checkRateLimit(`login-direct:${ip}`)
    if (!rl.allowed) {
      logAuth('login-direct', ip, 'RATE_LIMITED')
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    let matricNumber: string
    let email: string
    try {
      const body = await req.json()
      matricNumber = body.matric_number
      email = body.email
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!matricNumber || typeof matricNumber !== 'string') {
      return NextResponse.json({ error: 'Matric number is required' }, { status: 400 })
    }
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedMatric = matricNumber.trim().toUpperCase()
    const normalizedEmail = email.trim().toLowerCase()

    const supabase = createAdminClient()

    const { data: settings } = await supabase
      .from('settings')
      .select('voting_open')
      .eq('id', 1)
      .maybeSingle()

    const { data: student, error: dbError } = await supabase
      .from('students')
      .select('id, email, matric_number, has_voted')
      .eq('matric_number', normalizedMatric)
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (dbError) {
      logError('login-direct', 'db', dbError.message)
      return NextResponse.json({ error: 'Database error.' }, { status: 500 })
    }

    if (!student) {
      logAuth('login-direct', normalizedMatric, 'NOT_FOUND')
      return NextResponse.json({ error: 'No student found with this matric number and email combination' }, { status: 404 })
    }

    if (settings?.voting_open && student.has_voted) {
      logAuth('login-direct', normalizedMatric, 'ALREADY_VOTED')
      return NextResponse.json({ error: 'You have already voted' }, { status: 401 })
    }

    const exp = getCookieExpiry()
    const cookie = await createSessionCookie({
      email: student.email,
      id: student.id,
      matric_number: student.matric_number ?? null,
      exp,
    })

    const response = NextResponse.json({
      success: true,
      voting_open: settings?.voting_open ?? false,
    })
    response.headers.append('Set-Cookie', cookie)
    logAuth('login-direct', normalizedMatric, 'SUCCESS')
    return response
  } catch (err) {
    logError('login-direct', 'unknown', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
