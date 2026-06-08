function getConfig() {
  const apiKey = process.env.RESEND_API_KEY
  const fromDomain = process.env.RESEND_FROM_DOMAIN
  if (!apiKey || !fromDomain) {
    throw new Error('Missing RESEND_API_KEY or RESEND_FROM_DOMAIN env vars')
  }
  return { apiKey, fromDomain }
}

export async function sendOtpEmail(to: string, otp: string, electionName: string): Promise<void> {
  const { apiKey, fromDomain } = getConfig()

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${electionName} <noreply@${fromDomain}>`,
      to: [to],
      subject: `Your OTP Code for ${electionName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 56px; height: 56px; background: #1A4A3A; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
              <span style="font-size: 28px;">🗳️</span>
            </div>
            <h1 style="font-size: 22px; margin: 0; color: #1A4A3A;">${electionName}</h1>
          </div>
          <div style="background: #f8f6f3; border-radius: 12px; padding: 24px;">
            <p style="margin: 0 0 16px; color: #333; font-size: 14px; line-height: 1.5;">
              You requested a one-time code to sign in. Enter this code to cast your vote:
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1A4A3A; background: #fff; padding: 12px 24px; border-radius: 8px; border: 2px solid #C9A84C;">
                ${otp}
              </span>
            </div>
            <p style="margin: 0; color: #888; font-size: 12px;">
              This code expires in 10 minutes. If you didn't request this, ignore this email.
            </p>
          </div>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error (${res.status}): ${body}`)
  }
}
