import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSessionFromCookie } from '@/lib/session'

export async function GET(req: NextRequest) {
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
        get(name: string) {
          const cookie = req.headers.get('cookie') ?? ''
          const match = cookie.match(new RegExp(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`))
          return match?.[2] ?? null
        },
        getAll() { return [] },
        setAll() {},
      },
    }
  )

  const { data: { session: authSession } } = await supabase.auth.getSession()
  if (authSession?.user) {
    return NextResponse.json({
      user: { email: authSession.user.email!, id: authSession.user.id },
      type: 'admin',
    })
  }

  return NextResponse.json({ user: null }, { status: 401 })
}
