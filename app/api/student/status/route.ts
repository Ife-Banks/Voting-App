import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getSessionFromCookie } from '@/lib/session'

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookie(req.headers.get('cookie') ?? null)
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: student } = await supabase
      .from('students')
      .select('has_voted')
      .eq('email', session.email)
      .maybeSingle()

    return NextResponse.json({ has_voted: student?.has_voted ?? false })
  } catch {
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
