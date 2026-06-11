import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getCallerEmail } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  try {
    const callerEmail = await getCallerEmail(req)
    if (!callerEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Super admin check — fallback if table doesn't exist
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

    try {
      const { data: admins, error } = await supabase
        .from('admin_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return NextResponse.json({ admins })
    } catch {
      // Table doesn't exist — return empty list
      return NextResponse.json({ admins: [] })
    }
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
