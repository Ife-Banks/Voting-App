import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { logError } from '@/lib/logger'

function extractAccessToken(cookies: { name: string; value: string }[]): string | null {
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/(.+)\.supabase\.co/)?.[1]
  const prefix = projectRef ? `sb-${projectRef}-auth-token` : '-auth-token'
  const authCookie = cookies.find(c => c.name === prefix || c.name.includes(prefix))
  if (!authCookie) return null
  const raw = authCookie.value
  try {
    const base64 = raw.startsWith('base64-') ? raw.slice(7) : raw
    const json = JSON.parse(Buffer.from(base64, 'base64url').toString('utf-8'))
    const session = json?.session ?? json
    if (session?.access_token) return session.access_token
  } catch {}
  try {
    const json = JSON.parse(raw)
    const session = json?.session ?? json
    if (session?.access_token) return session.access_token
  } catch {}
  if (raw.split('.').length === 3) return raw
  return null
}

async function getCallerAdmin(req: NextRequest) {
  try {
    const accessToken = extractAccessToken(req.cookies.getAll())
    if (!accessToken) return null

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: { user } } = await supabase.auth.getUser(accessToken)
    const email = user?.email
    if (!email) return null

    if (email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return { id: '', role: 'super_admin' }
    }

    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('admin_profiles')
      .select('id, role')
      .eq('email', email)
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
    if (action === 'toggle_award_open') {
      const { award_open } = body as { award_open: boolean }
      const { data, error } = await supabase
        .from('settings')
        .update({ award_open })
        .eq('id', 1)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (action === 'save_settings') {
      const { award_name, school_name, price_per_vote_kobo } = body as {
        award_name?: string; school_name?: string; price_per_vote_kobo?: number
      }
      const updates: Record<string, unknown> = {}
      if (award_name !== undefined) updates.award_name = award_name
      if (school_name !== undefined) updates.school_name = school_name
      if (price_per_vote_kobo !== undefined) updates.price_per_vote_kobo = price_per_vote_kobo
      updates.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('settings')
        .update(updates)
        .eq('id', 1)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    logError('admin-settings', 'unknown', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
