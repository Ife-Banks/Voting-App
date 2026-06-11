import { NextRequest, NextResponse } from 'next/server'
import { verifyInviteToken } from '@/lib/invite'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    const payload = await verifyInviteToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    return NextResponse.json({ valid: true, email: payload.email, name: payload.name })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
