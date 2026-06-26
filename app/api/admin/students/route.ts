import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { logError } from '@/lib/logger'

async function getCallerAdmin(req: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            const cookie = req.headers.get('cookie') ?? ''
            if (!cookie) return []
            return cookie.split(';').map(pair => {
              const [name, ...rest] = pair.trim().split('=')
              return { name, value: rest.join('=') }
            })
          },
          setAll() {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return null

    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('admin_profiles')
      .select('id, role')
      .eq('email', user.email)
      .maybeSingle()
    return profile
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const admin = await getCallerAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Not authenticated as admin' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { action } = body
  const supabase = createAdminClient()

  try {
    if (action === 'add_student') {
      const { email, matric_number } = body as { email: string; matric_number: string }
      const { data, error } = await supabase
        .from('students')
        .insert({ email: email.toLowerCase().trim(), matric_number: matric_number ? matric_number.trim().toUpperCase() : null })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (action === 'delete_student') {
      const { id } = body as { id: string }
      const { error } = await supabase.from('students').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (action === 'reset_vote') {
      const { id, student_email } = body as { id: string; student_email: string }
      const { error } = await supabase.from('students').update({ has_voted: false }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await supabase.from('votes').delete().eq('student_email', student_email)
      return NextResponse.json({ success: true })
    }

    if (action === 'bulk_import') {
      const { rows } = body as { rows: { email: string; matric_number: string | null }[] }
      const cleaned = rows.map(r => ({
        email: r.email.toLowerCase().trim(),
        matric_number: r.matric_number,
      }))
      const { data, error } = await supabase.from('students').upsert(cleaned, { onConflict: 'email' }).select()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    logError('admin-students', 'unknown', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}