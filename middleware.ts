import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value ?? null
        },
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: { path?: string; maxAge?: number; domain?: string; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none' } }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Check Supabase Auth session (admin)
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  // Check custom student session
  const studentSession = await getSessionFromCookie(request.cookies.toString())
  const isLoggedIn = user || studentSession

  const path = request.nextUrl.pathname

  // Public paths
  if (path.startsWith('/login') || path.startsWith('/admin/login') || path.startsWith('/api')) {
    return supabaseResponse
  }

  // Not logged in → login
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
