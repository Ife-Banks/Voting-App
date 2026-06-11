import { NextRequest, NextResponse } from 'next/server'
import { verifyInviteToken } from '@/lib/invite'
import { createAuthAdminClient } from '@/lib/supabase-server'
import { logAuth, logError } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const payload = await verifyInviteToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 400 })
    }

    const authAdmin = createAuthAdminClient()

    const { data: users, error: listError } = await authAdmin.auth.admin.listUsers()
    if (listError) {
      logError('admin-setup', 'listUsers', listError.message)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }

    const user = users.users.find(u => u.email === payload.email)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { error: updateError } = await authAdmin.auth.admin.updateUserById(user.id, {
      password,
    })

    if (updateError) {
      logError('admin-setup', 'updateUser', updateError.message)
      return NextResponse.json({ error: 'Failed to set password' }, { status: 500 })
    }

    logAuth('admin-setup', payload.email, 'SUCCESS')

    return NextResponse.json({ success: true })
  } catch (err) {
    logError('admin-setup', 'unknown', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
