import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createAuthAdminClient } from '@/lib/supabase-server'
import { getCallerEmail } from '@/lib/admin-auth'
import { logError } from '@/lib/logger'

export async function DELETE(req: NextRequest) {
  try {
    const callerEmail = await getCallerEmail(req)
    if (!callerEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const isConfiguredAdmin = callerEmail === process.env.NEXT_PUBLIC_ADMIN_EMAIL
    if (!isConfiguredAdmin) {
      const { data: caller } = await supabase
        .from('admin_profiles')
        .select('role')
        .eq('email', callerEmail)
        .single()
      if (!caller || caller.role !== 'super_admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { adminId } = await req.json()
    if (!adminId) {
      return NextResponse.json({ error: 'adminId required' }, { status: 400 })
    }

    const { data: target } = await supabase
      .from('admin_profiles')
      .select('user_id, role')
      .eq('id', adminId)
      .single()

    if (!target) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    if (target.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot delete super admin' }, { status: 403 })
    }

    const authAdmin = createAuthAdminClient()

    if (target.user_id) {
      await authAdmin.auth.admin.deleteUser(target.user_id)
    }

    const { error } = await supabase.from('admin_profiles').delete().eq('id', adminId)
    if (error) {
      logError('admin-delete', 'delete', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    logError('admin-delete', 'unknown', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
