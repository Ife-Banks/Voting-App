import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'

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

  const supabase = createAdminClient()
  const body = await req.json()
  const { action } = body

  try {
    if (action === 'add_position') {
      const { title, description, display_order } = body
      const { data, error } = await supabase.from('positions').insert({
        title, description: description ?? null, display_order: display_order ?? 0,
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (action === 'update_position') {
      const { id, title, description } = body
      const { data, error } = await supabase.from('positions').update({
        title, description: description ?? null,
      }).eq('id', id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (action === 'delete_position') {
      const { id } = body
      const { error } = await supabase.from('positions').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (action === 'add_candidate') {
      const { position_id, full_name, class: cls, manifesto, photo_url } = body
      const { data, error } = await supabase.from('candidates').insert({
        position_id, full_name, class: cls ?? null, manifesto: manifesto ?? null,
        photo_url: photo_url ?? null,
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (action === 'update_candidate') {
      const { id, full_name, class: cls, manifesto, photo_url } = body
      const { data, error } = await supabase.from('candidates').update({
        full_name, class: cls ?? null, manifesto: manifesto ?? null, photo_url: photo_url ?? null,
      }).eq('id', id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (action === 'delete_candidate') {
      const { id } = body
      const { error } = await supabase.from('candidates').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}