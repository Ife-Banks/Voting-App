import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { getSessionFromCookie } from '@/lib/session'
import { logAuth } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    // Check custom student session first
    const session = await getSessionFromCookie(req.headers.get('cookie') ?? null)
    if (session) {
      return NextResponse.json({
        user: { email: session.email, id: session.id },
        type: 'student',
      })
    }

    // Fall back to Supabase Auth (admin)
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
          setAll(_cookiesToSet: { name: string; value: string; options: any }[], _headers: Record<string, string>) {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const isConfiguredAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
    let isAdmin = isConfiguredAdmin
    if (!isAdmin) {
      try {
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )
        const { data: profile } = await adminClient
          .from('admin_profiles')
          .select('id')
          .eq('email', user.email)
          .single()
        isAdmin = !!profile
      } catch {}
    }
    logAuth('me', user.email, isAdmin ? 'admin' : 'student-user')
    return NextResponse.json({
      user: { email: user.email, id: user.id },
      type: isAdmin ? 'admin' : 'student',
    })
  } catch (err) {
    return NextResponse.json({ user: null, error: 'Auth check failed' }, { status: 500 })
  }
}
