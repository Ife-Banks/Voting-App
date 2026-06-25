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
    if (action === 'create_session') {
      const { title } = body as { title: string }
      await supabase.from('voting_sessions').update({ is_active: false }).eq('is_active', true)
      const { data, error } = await supabase
        .from('voting_sessions')
        .insert({ title: title.trim(), is_active: true })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await supabase.from('settings').update({ election_name: data.title }).eq('id', 1)
      const { data: sessions } = await supabase.from('voting_sessions').select('*').order('created_at', { ascending: false })
      return NextResponse.json({ data, sessions })
    }

    if (action === 'end_session') {
      const { id } = body as { id: string }
      const { error } = await supabase
        .from('voting_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await supabase.from('settings').update({ election_name: 'Voting Closed' }).eq('id', 1)
      const { data: sessions } = await supabase.from('voting_sessions').select('*').order('created_at', { ascending: false })
      const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 1).single()
      return NextResponse.json({ sessions, settings: settingsData })
    }

    if (action === 'activate_session') {
      const { id, title } = body as { id: string; title: string }
      await supabase.from('voting_sessions').update({ is_active: false }).neq('id', id)
      const { error } = await supabase
        .from('voting_sessions')
        .update({ is_active: true, ended_at: null })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await supabase.from('settings').update({ election_name: title }).eq('id', 1)
      const { data: sessions } = await supabase.from('voting_sessions').select('*').order('created_at', { ascending: false })
      const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 1).single()
      return NextResponse.json({ sessions, settings: settingsData })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    logError('admin-sessions', 'unknown', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}