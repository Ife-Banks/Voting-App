import Mailgun from 'mailgun.js'
import FormData from 'form-data'

const API_KEY = process.env.MAILGUN_API_KEY
const DOMAIN = process.env.MAILGUN_DOMAIN
const BASE_URL = process.env.MAILGUN_BASE_URL ?? 'https://api.mailgun.net'

export async function sendOtpEmail(to: string, otp: string): Promise<boolean> {
  if (!API_KEY || !DOMAIN) {
    console.warn('[mailgun] MAILGUN_API_KEY or MAILGUN_DOMAIN not set, skipping email')
    return false
  }

  try {
    const mailgun = new Mailgun(FormData)
    const mg = mailgun.client({
      username: 'api',
      key: API_KEY,
      url: BASE_URL,
    })

    const data = await mg.messages.create(DOMAIN, {
      from: `ESSA Elections <noreply@${DOMAIN}>`,
      to: [to],
      subject: 'Your ESSA Elections OTP Code',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0A1A0A;color:#F5F0E8">
  <div style="text-align:center;margin-bottom:32px">
    <h1 style="color:#4CAF50;font-size:28px;margin:0 0 8px">ESSA Elections</h1>
    <p style="color:#888;font-size:13px">Your one-time verification code</p>
  </div>
  <div style="background:rgba(76,175,80,0.08);border:1px solid rgba(76,175,80,0.2);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px">
    <p style="color:rgba(245,240,232,0.6);font-size:13px;margin:0 0 12px">Your OTP Code</p>
    <p style="font-size:40px;font-weight:700;color:#4CAF50;letter-spacing:8px;margin:0">${otp}</p>
    <p style="color:rgba(245,240,232,0.4);font-size:11px;margin:16px 0 0">Expires in 60 seconds</p>
  </div>
  <p style="color:rgba(245,240,232,0.4);font-size:12px;line-height:1.6;text-align:center">If you did not request this code, please ignore this email.</p>
  <hr style="border:none;border-top:1px solid rgba(76,175,80,0.1);margin:24px 0" />
  <p style="color:#555;font-size:11px;text-align:center">ESSA Voting System</p>
</div>`,
      text: `ESSA Elections - Your OTP is ${otp}. It expires in 60 seconds.\n\nIf you did not request this code, please ignore this email.`,
    })

    console.log('[mailgun] Email sent:', data)
    return true
  } catch (err) {
    console.error('[mailgun] Send failed:', err)
    return false
  }
}