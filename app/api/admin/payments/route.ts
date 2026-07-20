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

    // Verify admin
    const isConfiguredAdmin = email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
    if (!isConfiguredAdmin) {
      const { data: caller } = await supabase
        .from('admin_profiles')
        .select('id')
        .eq('email', email)
        .single()
      if (!caller) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { data: payments, error } = await supabase
      .from('payments')
      .select('*, candidate:candidates(*), position:positions(*)')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ payments })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
