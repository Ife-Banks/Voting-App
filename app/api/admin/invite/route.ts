import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient, createAuthAdminClient } from '@/lib/supabase-server'
import { createInviteToken } from '@/lib/invite'
import { sendInviteEmail } from '@/lib/email'
import { logAuth, logError } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const start = Date.now()
  const steps: string[] = []

  try {
    const { email, name } = await req.json()
    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    steps.push('parsed')

    const callerEmail = await getCallerEmail(req)
    steps.push('callerEmail=' + (callerEmail ?? 'null'))
    if (!callerEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const isConfiguredAdmin = callerEmail === process.env.NEXT_PUBLIC_ADMIN_EMAIL
    steps.push('isConfiguredAdmin=' + isConfiguredAdmin)

    if (!isConfiguredAdmin) {
      const { data: caller, error: callerErr } = await supabase
        .from('admin_profiles')
        .select('role')
        .eq('email', callerEmail)
        .single()
      steps.push('callerCheck=' + (callerErr ? 'err:' + callerErr.message : (caller?.role ?? 'null')))
      if (!caller || caller.role !== 'super_admin') {
        return NextResponse.json({ error: 'Only super admins can invite' }, { status: 403 })
      }
    }

    try {
      const { data: existing } = await supabase
        .from('admin_profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle()
      steps.push('existing=' + (existing ? 'yes' : 'no'))
      if (existing) {
        return NextResponse.json({ error: 'This email is already an admin' }, { status: 409 })
      }
    } catch {
      steps.push('existing-skip')
    }

    steps.push('before-createUser')
    const authAdmin = createAuthAdminClient()
    const tempPassword = crypto.randomUUID().replace(/-/g, '').slice(0, 20)

    const { data: authUser, error: createError } = await authAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
    })
    steps.push('after-createUser error=' + (createError?.message ?? 'none'))

    if (createError) {
      logError('admin-invite', 'createUser', createError.message)
      return NextResponse.json({ error: 'Failed to create admin user: ' + createError.message }, { status: 500 })
    }

    if (!authUser.user) {
      steps.push('user-null')
      return NextResponse.json({ error: 'Failed to create admin user' }, { status: 500 })
    }
    steps.push('userId=' + authUser.user.id)

    const { error: profileError } = await supabase.from('admin_profiles').insert({
      user_id: authUser.user.id,
      email: normalizedEmail,
      name,
      role: 'admin',
      permissions: { view_results: true, view_positions: true },
      created_by: callerEmail,
    })
    steps.push('profileInsert error=' + (profileError?.message ?? 'ok'))
    if (profileError) {
      if (profileError.code === '42P01') {
        steps.push('profileInsert-table-missing')
      } else {
        logError('admin-invite', 'insert', profileError.message)
        await authAdmin.auth.admin.deleteUser(authUser.user.id)
        return NextResponse.json({ error: 'Failed to create admin profile: ' + profileError.message }, { status: 500 })
      }
    }

    steps.push('before-inviteToken')
    const token = await createInviteToken(normalizedEmail, name)
    const origin = req.headers.get('origin') ?? 'http://localhost:3000'
    const setupLink = `${origin}/admin/setup?token=${encodeURIComponent(token)}`
    steps.push('token-created')

    steps.push('before-email')
    const emailSent = await sendInviteEmail(normalizedEmail, name, setupLink)
    steps.push('emailSent=' + emailSent)

    logAuth('admin-invite', normalizedEmail, `SUCCESS (${Date.now() - start}ms)`)

    return NextResponse.json({ success: true, setupLink, emailSent })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    logError('admin-invite', 'unknown', msg)
    console.error('[INVITE ERROR]', steps.join(' | '), '| msg:', msg)
    return NextResponse.json({
      error: 'Server error',
      detail: msg,
      steps,
    }, { status: 500 })
  }
}

async function getCallerEmail(req: NextRequest): Promise<string | null> {
  try {
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
          setAll() {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user?.email ?? null
  } catch {
    return null
  }
}
