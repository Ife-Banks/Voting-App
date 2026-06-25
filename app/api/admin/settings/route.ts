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
    if (action === 'toggle_voting') {
      const { voting_open } = body as { voting_open: boolean }
      const { data, error } = await supabase
        .from('settings')
        .update({ voting_open })
        .eq('id', 1)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (action === 'toggle_results_public') {
      const { results_public } = body as { results_public: boolean }
      const { data, error } = await supabase
        .from('settings')
        .update({ results_public })
        .eq('id', 1)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (action === 'save_settings') {
      const { election_name, school_name } = body as { election_name: string; school_name: string }
      const { data, error } = await supabase
        .from('settings')
        .update({ election_name, school_name })
        .eq('id', 1)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (action === 'end_session') {
      const { session_id } = body as { session_id: string }
      const { error } = await supabase
        .from('voting_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', session_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await supabase.from('settings').update({ voting_open: false }).eq('id', 1)
      const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 1).single()
      return NextResponse.json({ settings: settingsData })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    logError('admin-settings', 'unknown', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}