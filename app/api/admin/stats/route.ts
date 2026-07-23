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

export async function GET(req: NextRequest) {
  const admin = await getCallerAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Not authenticated as admin' }, { status: 401 })
  }

  const supabase = createAdminClient()
  try {
    const [{ data: positions }, { data: candidates }, { data: payments }] = await Promise.all([
      supabase.from('positions').select('id', { count: 'exact', head: true }),
      supabase.from('candidates').select('id', { count: 'exact', head: true }),
      supabase.from('payments').select('amount_kobo, status').eq('status', 'success'),
    ])

    return NextResponse.json({
      positions: positions?.length ?? 0,
      candidates: candidates?.length ?? 0,
      payments: payments?.length ?? 0,
      totalRevenue: payments?.reduce((sum, p) => sum + ((p as any).amount_kobo ?? 0), 0) ?? 0,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    logError('admin-stats', 'fetch', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
