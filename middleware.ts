import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

const isProduction = process.env.NODE_ENV === 'production'

function buildCSP(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const host = url ? new URL(url).host : '*.supabase.co'
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://checkout.flutterwave.com`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https://${host} https://checkout.flutterwave.com`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `connect-src 'self' https://${host} wss://${host} https://vercel.live https://api.flutterwave.com https://api.ravepay.co https://flw-events-ge.myflutterwave.com https://cors-anywhere.herokuapp.com`,
    `frame-src 'self' https://vercel.live https://checkout.flutterwave.com https://checkout-v3.flutterwave.com`,
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
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  // Cross-Origin-Embedder-Policy intentionally omitted — it blocks Flutterwave's
  // checkout iframe (no matching COEP header) with NS_ERROR_DOM_COEP_FAILED.
  // This app has no SharedArrayBuffer or WASM threading dependency, and the
  // payment flow's need for a third-party iframe wins this tradeoff.
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')
  return response
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Public paths — always allow
  if (path.startsWith('/admin/login') || path.startsWith('/admin/setup') || path.startsWith('/api') || path.startsWith('/_next')) {
    return addSecurityHeaders(NextResponse.next())
  }

  // Only need Supabase Auth for admin pages
  if (path.startsWith('/admin')) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, { ...options, secure: isProduction })
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/admin/login', request.url)))
    }

    const userEmail = user.email ?? ''
    const isConfiguredAdmin = userEmail === process.env.NEXT_PUBLIC_ADMIN_EMAIL

    // Check if user is an admin (via admin_profiles)
    let userIsAdmin = isConfiguredAdmin
    if (!userIsAdmin) {
      try {
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )
        const { data: adminProfile } = await adminClient
          .from('admin_profiles')
          .select('id')
          .eq('email', userEmail)
          .single()
        userIsAdmin = !!adminProfile
      } catch {}
    }

    if (!userIsAdmin) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/', request.url)))
    }

    return addSecurityHeaders(supabaseResponse)
  }

  // Block regular admins from /leaderboard
  if (path === '/leaderboard' || path.startsWith('/leaderboard/')) {
    let supabaseResponse = NextResponse.next({ request })
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, { ...options, secure: isProduction })
            )
          },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      const isSuperAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
      if (!isSuperAdmin) {
        try {
          const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
          )
          const { data: adminProfile } = await adminClient
            .from('admin_profiles')
            .select('id')
            .eq('email', user.email)
            .single()
          if (adminProfile) {
            return addSecurityHeaders(NextResponse.redirect(new URL('/admin/dashboard', request.url)))
          }
        } catch {}
      }
    }
    return addSecurityHeaders(supabaseResponse)
  }

  // All public pages pass through
  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
