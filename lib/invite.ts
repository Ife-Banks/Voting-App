const INVITE_COOKIE_NAME = 'admin_invite'

async function getSecret(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters')
  }
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export interface InvitePayload {
  email: string
  name: string
  exp: number
}

export async function createInviteToken(email: string, name: string): Promise<string> {
  const payload: InvitePayload = { email, name, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }
  const encoded = btoa(JSON.stringify(payload))
  const secret = await getSecret()
  const sig = await crypto.subtle.sign('HMAC', secret, new TextEncoder().encode(encoded))
  const sigArr = new Uint8Array(sig)
  let sigStr = ''
  for (let i = 0; i < sigArr.length; i++) sigStr += String.fromCharCode(sigArr[i])
  return `${encoded}.${btoa(sigStr)}`
}

export async function verifyInviteToken(token: string): Promise<InvitePayload | null> {
  const lastDot = token.lastIndexOf('.')
  if (lastDot === -1) return null
  const encoded = token.slice(0, lastDot)
  const sigB64 = token.slice(lastDot + 1)
  try {
    const secret = await getSecret()
    const sigStr = atob(sigB64)
    const sig = new Uint8Array(sigStr.length)
    for (let i = 0; i < sigStr.length; i++) sig[i] = sigStr.charCodeAt(i)
    const valid = await crypto.subtle.verify('HMAC', secret, sig, new TextEncoder().encode(encoded))
    if (!valid) return null
    const payload: InvitePayload = JSON.parse(atob(encoded))
    if (Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}
