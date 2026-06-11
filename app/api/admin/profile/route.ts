import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getCallerEmail } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  try {
    const email = await getCallerEmail(req)
    if (!email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createAdminClient()

    try {
      const { data: profile, error } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('email', email)
        .single()

      if (!error && profile) {
        return NextResponse.json({ profile })
      }
    } catch {}

    // Fallback: return configured admin as super admin
    if (email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return NextResponse.json({
        profile: {
          id: '',
          user_id: '',
          email,
          name: email.split('@')[0],
          role: 'super_admin',
          permissions: { view_results: true, view_positions: true },
          created_at: new Date().toISOString(),
        }
      })
    }

    return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
