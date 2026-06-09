import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
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

    const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
    logAuth('me', user.email, isAdmin ? 'admin' : 'student-user')
    return NextResponse.json({
      user: { email: user.email, id: user.id },
      type: isAdmin ? 'admin' : 'student',
    })
  } catch (err) {
    return NextResponse.json({ user: null, error: 'Auth check failed' }, { status: 500 })
  }
}
