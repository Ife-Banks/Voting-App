import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function extractAccessToken(cookies: { name: string; value: string }[]): string | null {
  // Match auth-token cookie for the current Supabase project only
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/(.+)\.supabase\.co/)?.[1]
  const prefix = projectRef ? `sb-${projectRef}-auth-token` : '-auth-token'
  const authCookie = cookies.find(c => c.name === prefix || c.name.includes(prefix))
  if (!authCookie) return null

  const raw = authCookie.value

  // Try base64url-decoded JSON with session wrapper
  try {
    const base64 = raw.startsWith('base64-') ? raw.slice(7) : raw
    const json = JSON.parse(Buffer.from(base64, 'base64url').toString('utf-8'))
    const session = json?.session ?? json
    if (session?.access_token) return session.access_token
  } catch {}

  // Try raw JSON
  try {
    const json = JSON.parse(raw)
    const session = json?.session ?? json
    if (session?.access_token) return session.access_token
  } catch {}

  // Try JWT directly
  if (raw.split('.').length === 3) return raw

  return null
}

export async function getCallerEmail(req: NextRequest): Promise<string | null> {
  try {
    const cookies = req.cookies.getAll()
    const accessToken = extractAccessToken(cookies)
    if (!accessToken) return null

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: { user } } = await supabase.auth.getUser(accessToken)
    return user?.email ?? null
  } catch {
    return null
  }
}
