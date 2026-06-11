const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_DOMAIN = process.env.RESEND_FROM_DOMAIN ?? 'devalyze.space'

export async function sendInviteEmail(to: string, name: string, setupLink: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping email send')
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `SRC Voting <noreply@${FROM_DOMAIN}>`,
        to: [to],
        subject: 'You have been invited as an Admin',
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
<h1 style="color:#C9A84C;font-size:24px;margin:0 0 8px">Admin Invitation</h1>
<p style="color:#333;font-size:14px;line-height:1.6">Hello ${name},</p>
<p style="color:#333;font-size:14px;line-height:1.6">You have been invited to manage the SRC Voting election. Click the button below to set up your password and get started.</p>
<a href="${setupLink}" style="display:inline-block;background:#C9A84C;color:#0A0A0F;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;margin:16px 0">Set Up Password</a>
<p style="color:#666;font-size:12px">Or copy this link into your browser:</p>
<p style="color:#666;font-size:12px;word-break:break-all">${setupLink}</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
<p style="color:#999;font-size:11px">SRC Voting System &bull; Abiola Ajimobi Technical University</p>
</div>`,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[email] Resend error:', res.status, body)
      return false
    }

    return true
  } catch (err) {
    console.error('[email] send failed:', err)
    return false
  }
}
