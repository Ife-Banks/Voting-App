import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/session'

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true })
  response.headers.append('Set-Cookie', clearSessionCookie())
  return response
}
