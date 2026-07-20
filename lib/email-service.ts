import { logError } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase-server'

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
      from: `NASSA Awards <noreply@${fromDomain}>`,
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

async function sendViaBrevo(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  const senderName = process.env.BREVO_SENDER_NAME ?? 'NASSA Awards'
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

async function sendViaMailjet(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const apiKey = process.env.MAILJET_API_KEY
  const apiSecret = process.env.MAILJET_API_SECRET
  const senderEmail = process.env.MAILJET_SENDER_EMAIL
  const senderName = process.env.MAILJET_SENDER_NAME ?? 'NASSA Awards'
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

function inviteHtml(name: string, setupLink: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A1A0A;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:32px">
  <h1 style="color:#4CAF50;font-size:24px;text-align:center;margin:0 0 6px">NASSA Student Choice Award</h1>
  <p style="color:#888;font-size:13px;text-align:center;margin:0 0 28px">Admin Invitation</p>
  <p style="color:#fff;font-size:14px;line-height:1.7;margin:0 0 10px">Hello ${name},</p>
  <p style="color:#fff;font-size:14px;line-height:1.7;margin:0 0 20px">You have been invited to manage the NASSA Student Choice Award. Click the button below to set up your password and get started.</p>
  <div style="text-align:center;margin:0 0 20px">
    <a href="${setupLink}" style="display:inline-block;background:#4CAF50;color:#0A1A0A;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Set Up Password</a>
  </div>
  <p style="color:#888;font-size:12px;margin:0 0 4px">Or copy this link into your browser:</p>
  <p style="color:#4CAF50;font-size:12px;word-break:break-all;margin:0 0 20px">${setupLink}</p>
   <hr style="border:none;border-top:1px solid rgba(76,175,80,0.1);margin:24px 0">
  <p style="color:#555;font-size:11px;text-align:center;margin:0">NASSA Student Choice Award &bull; Abiola Ajimobi Technical University</p>
</div></body></html>`
}

function inviteText(name: string, setupLink: string): string {
  return `NASSA Student Choice Award - You have been invited as an Admin.\n\nHello ${name},\n\nSet up your password: ${setupLink}`
}

type EmailProvider = 'resend' | 'brevo' | 'mailjet' | null

export async function sendEmail(params: {
  to: string; subject: string; html: string; text: string; purpose?: 'admin_invite' | 'test'
}): Promise<{ success: boolean; provider: EmailProvider }> {
  const { to, subject, html, text, purpose = 'admin_invite' } = params

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
    if (supabase) {
      await supabase.from('email_log').insert({ recipient, purpose, provider, success })
    }
  } catch {}
}

export async function sendAdminInviteEmail(to: string, name: string, setupLink: string): Promise<boolean> {
  const { success } = await sendEmail({
    to,
    subject: 'You have been invited as an Admin - NASSA Student Choice Award',
    html: inviteHtml(name, setupLink),
    text: inviteText(name, setupLink),
    purpose: 'admin_invite',
  })
  return success
}
