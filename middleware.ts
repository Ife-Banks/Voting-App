import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'

const isProduction = process.env.NODE_ENV === 'production'

function addSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '0')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return response
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Public paths — always allow
  if (path.startsWith('/login') || path.startsWith('/admin/login') || path.startsWith('/api') || path.startsWith('/_next')) {
    return addSecurityHeaders(NextResponse.next())
  }

  // 1. Check custom student session cookie first
  let studentSession = null
  try {
    studentSession = await getSessionFromCookie(request.headers.get('cookie'))
  } catch {
    // Session check failed — treat as logged out
  }
  if (studentSession) {
    // Student is logged in — block admin routes
    if (path.startsWith('/admin')) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/vote', request.url)))
    }
    return addSecurityHeaders(NextResponse.next())
  }

  // 2. Only need Supabase Auth for admin pages (or vote page for admin redirect)
  if (path.startsWith('/admin') || path.startsWith('/vote')) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options: any }[], headers: Record<string, string>) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, { ...options, secure: isProduction })
            )
            Object.entries(headers).forEach(([key, value]) =>
              supabaseResponse.headers.set(key, value)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/login', request.url)))
    }

    // Admin on vote page → redirect to dashboard
    if (path.startsWith('/vote') && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/admin/dashboard', request.url)))
    }

    // Non-admin on admin page → redirect to vote
    if (path.startsWith('/admin') && user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/vote', request.url)))
    }

    return addSecurityHeaders(supabaseResponse)
  }

  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
