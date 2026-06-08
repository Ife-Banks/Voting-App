import { createAdminClient } from './supabase-server'

const TTL_SEC = 10 * 60
const MAX_ATTEMPTS = 3
const RATE_LIMIT_MS = 30_000

export async function generateOtp(email: string): Promise<string> {
  const supabase = createAdminClient()

  const { data: student } = await supabase
    .from('students')
    .select('otp_created_at')
    .eq('email', email)
    .maybeSingle()

  if (student?.otp_created_at) {
    const elapsed = Date.now() - new Date(student.otp_created_at).getTime()
    if (elapsed < RATE_LIMIT_MS) {
      throw new Error('Please wait 30 seconds before requesting a new code')
    }
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + TTL_SEC * 1000).toISOString()

  const { error } = await supabase
    .from('students')
    .update({ otp_code: otp, otp_expires_at: expiresAt, otp_attempts: 0, otp_created_at: now })
    .eq('email', email)

  if (error) throw new Error('Failed to store OTP')
  return otp
}

export async function verifyOtp(email: string, otp: string): Promise<boolean> {
  const supabase = createAdminClient()

  const { data: student } = await supabase
    .from('students')
    .select('otp_code, otp_expires_at, otp_attempts')
    .eq('email', email)
    .maybeSingle()

  if (!student || !student.otp_code || !student.otp_expires_at) return false
  if (Date.now() > new Date(student.otp_expires_at).getTime()) return false
  if (student.otp_attempts >= MAX_ATTEMPTS) return false

  if (student.otp_code !== otp) {
    await supabase.from('students').update({ otp_attempts: (student.otp_attempts ?? 0) + 1 }).eq('email', email)
    return false
  }

  // Clear OTP on success
  await supabase.from('students').update({
    otp_code: null, otp_expires_at: null, otp_attempts: 0, otp_created_at: null,
  }).eq('email', email)

  return true
}
