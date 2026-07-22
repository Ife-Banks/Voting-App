import { logError } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase-server'

const OTP_EXPIRY_SECONDS = 60

// ── Resend ───────────────────────────────────────────────────────────────────
async function sendViaResend(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? 'devalyze.space'
  if (!apiKey) return false

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `NACOS Voting <noreply@${fromDomain}>`,
      to: [to],
      subject,
      html,
      text,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    logError('email-resend', 'send', `${res.status}: ${body}`)
    return false
  }
  return true
}

// ── Brevo (Sendinblue) ───────────────────────────────────────────────────────
async function sendViaBrevo(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  const senderName = process.env.BREVO_SENDER_NAME ?? 'NACOS Voting'
  if (!apiKey || !senderEmail) return false

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    logError('email-brevo', 'send', `${res.status}: ${body}`)
    return false
  }
  return true
}

// ── Mailjet ──────────────────────────────────────────────────────────────────
async function sendViaMailjet(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const apiKey = process.env.MAILJET_API_KEY
  const apiSecret = process.env.MAILJET_API_SECRET
  const senderEmail = process.env.MAILJET_SENDER_EMAIL
  const senderName = process.env.MAILJET_SENDER_NAME ?? 'NACOS Voting'
  if (!apiKey || !apiSecret || !senderEmail) return false

  const token = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  const res = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Messages: [{
        From: { Email: senderEmail, Name: senderName },
        To: [{ Email: to }],
        Subject: subject,
        HTMLPart: html,
        TextPart: text,
      }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    logError('email-mailjet', 'send', `${res.status}: ${body}`)
    return false
  }
  return true
}

// ── HTML Templates ───────────────────────────────────────────────────────────

function otpHtml(otp: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A1A0A;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:32px">
  <h1 style="color:#4CAF50;font-size:26px;text-align:center;margin:0 0 6px">NACOS Voting</h1>
   <p style="color:#888;font-size:13px;text-align:center;margin:0 0 28px">One-time verification code</p>
   <div style="background:rgba(76,175,80,0.06);border:1px solid rgba(76,175,80,0.15);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px">
     <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0 0 10px">Your OTP Code</p>
     <p style="font-size:42px;font-weight:700;color:#4CAF50;letter-spacing:10px;margin:0">${otp}</p>
    <p style="color:rgba(255,255,255,0.35);font-size:11px;margin:14px 0 0">Expires in ${OTP_EXPIRY_SECONDS} seconds</p>
  </div>
  <p style="color:rgba(255,255,255,0.35);font-size:12px;text-align:center;margin:0">If you did not request this code, please ignore this email.</p>
  <hr style="border:none;border-top:1px solid rgba(76,175,80,0.1);margin:24px 0">
  <p style="color:#555;font-size:11px;text-align:center;margin:0">NACOS Voting System &bull; Abiola Ajimobi Technical University</p>
</div></body></html>`
}

function otpText(otp: string): string {
  return `NACOS Voting - Your OTP is ${otp}. It expires in ${OTP_EXPIRY_SECONDS} seconds.\n\nIf you did not request this code, please ignore this email.`
}

function inviteHtml(name: string, setupLink: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A1A0A;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:32px">
  <h1 style="color:#4CAF50;font-size:24px;text-align:center;margin:0 0 6px">NACOS Voting</h1>
  <p style="color:#888;font-size:13px;text-align:center;margin:0 0 28px">Admin Invitation</p>
  <p style="color:#fff;font-size:14px;line-height:1.7;margin:0 0 10px">Hello ${name},</p>
  <p style="color:#fff;font-size:14px;line-height:1.7;margin:0 0 20px">You have been invited to manage the NACOS elections. Click the button below to set up your password and get started.</p>
  <div style="text-align:center;margin:0 0 20px">
    <a href="${setupLink}" style="display:inline-block;background:#4CAF50;color:#0A1A0A;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Set Up Password</a>
  </div>
  <p style="color:#888;font-size:12px;margin:0 0 4px">Or copy this link into your browser:</p>
  <p style="color:#4CAF50;font-size:12px;word-break:break-all;margin:0 0 20px">${setupLink}</p>
   <hr style="border:none;border-top:1px solid rgba(76,175,80,0.1);margin:24px 0">
  <p style="color:#555;font-size:11px;text-align:center;margin:0">NACOS Voting System &bull; Abiola Ajimobi Technical University</p>
</div></body></html>`
}

function inviteText(name: string, setupLink: string): string {
  return `NACOS Voting - You have been invited as an Admin.\n\nHello ${name},\n\nSet up your password: ${setupLink}`
}

// ── Public API ───────────────────────────────────────────────────────────────

type EmailProvider = 'resend' | 'brevo' | 'mailjet' | null

export async function sendEmail(params: {
  to: string; subject: string; html: string; text: string; purpose?: 'otp' | 'admin_invite' | 'test'
}): Promise<{ success: boolean; provider: EmailProvider }> {
  const { to, subject, html, text, purpose = 'otp' } = params

  const providers: { name: EmailProvider; fn: () => Promise<boolean> }[] = [
    { name: 'resend',  fn: () => sendViaResend(to, subject, html, text) },
    { name: 'brevo',   fn: () => sendViaBrevo(to, subject, html, text) },
    { name: 'mailjet', fn: () => sendViaMailjet(to, subject, html, text) },
  ]

  for (const p of providers) {
    try {
      const ok = await p.fn()
      if (ok) {
        console.log(`[email-service] Sent via ${p.name}`)
        await logEmailAttempt(to, purpose, p.name, true)
        return { success: true, provider: p.name }
      }
    } catch (err) {
      logError('email-service', `send-${p.name}`, err instanceof Error ? err.message : String(err))
    }
  }

  logError('email-service', 'send', 'All 3 email providers failed')
  await logEmailAttempt(to, purpose, null, false)
  return { success: false, provider: null }
}

async function logEmailAttempt(recipient: string, purpose: string, provider: EmailProvider, success: boolean) {
  try {
    const supabase = createAdminClient()
    await supabase.from('email_log').insert({ recipient, purpose, provider, success })
  } catch (err) {
    logError('email-service', 'log-attempt', err instanceof Error ? err.message : String(err))
  }
}

export async function sendOtpEmail(to: string, otp: string): Promise<boolean> {
  const { success } = await sendEmail({
    to,
    subject: 'Your NACOS Voting OTP Code',
    html: otpHtml(otp),
    text: otpText(otp),
    purpose: 'otp',
  })
  return success
}

export async function sendAdminInviteEmail(to: string, name: string, setupLink: string): Promise<boolean> {
  const { success } = await sendEmail({
    to,
    subject: 'You have been invited as an Admin - NACOS Voting',
    html: inviteHtml(name, setupLink),
    text: inviteText(name, setupLink),
    purpose: 'admin_invite',
  })
  return success
}
