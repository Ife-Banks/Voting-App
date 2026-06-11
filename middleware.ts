import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'

const isProduction = process.env.NODE_ENV === 'production'

function buildCSP(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const host = url ? new URL(url).host : '*.supabase.co'
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https://${host}`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `connect-src 'self' https://${host} wss://${host}`,
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

function addSecurityHeaders(response: NextResponse) {
  response.headers.set('Content-Security-Policy', buildCSP())
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '0')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')
  return response
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Public paths — always allow
  if (path.startsWith('/login') || path.startsWith('/admin/login') || path.startsWith('/admin/setup') || path.startsWith('/api') || path.startsWith('/_next')) {
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

    const userEmail = user.email ?? ''
    const isConfiguredAdmin = userEmail === process.env.NEXT_PUBLIC_ADMIN_EMAIL

    // Check if user is an admin (via admin_profiles table, fall back to configured admin)
    let userIsAdmin = isConfiguredAdmin
    if (!userIsAdmin) {
      try {
        const { data: adminProfile } = await supabase
          .from('admin_profiles')
          .select('id')
          .eq('email', userEmail)
          .single()
        userIsAdmin = !!adminProfile
      } catch {}
    }

    // Admin on vote page → redirect to dashboard
    if (path.startsWith('/vote') && userIsAdmin) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/admin/dashboard', request.url)))
    }

    // Non-admin on admin page → redirect to vote
    if (path.startsWith('/admin') && !userIsAdmin) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/vote', request.url)))
    }

    return addSecurityHeaders(supabaseResponse)
  }

  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
