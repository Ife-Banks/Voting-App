export interface SessionData {
  email: string
  id: string
  exp: number
}

const COOKIE_NAME = 'student_session'
const MAX_AGE = 60 * 60 * 24

const isProduction = process.env.NODE_ENV === 'production'

async function getSecret(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters')
  }
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

async function sign(data: SessionData): Promise<string> {
  const payload = btoa(JSON.stringify(data))
  const secret = await getSecret()
  const sig = await crypto.subtle.sign('HMAC', secret, new TextEncoder().encode(payload))
  const sigArr = new Uint8Array(sig)
  let sigStr = ''
  for (let i = 0; i < sigArr.length; i++) sigStr += String.fromCharCode(sigArr[i])
  return `${payload}.${btoa(sigStr)}`
}

async function verify(token: string): Promise<SessionData | null> {
  const lastDot = token.lastIndexOf('.')
  if (lastDot === -1) return null
  const payload = token.slice(0, lastDot)
  const sigB64 = token.slice(lastDot + 1)
  try {
    const secret = await getSecret()
    const sigStr = atob(sigB64)
    const sig = new Uint8Array(sigStr.length)
    for (let i = 0; i < sigStr.length; i++) sig[i] = sigStr.charCodeAt(i)
    const valid = await crypto.subtle.verify('HMAC', secret, sig, new TextEncoder().encode(payload))
    if (!valid) return null
    const data: SessionData = JSON.parse(atob(payload))
    if (Date.now() > data.exp) return null
    return data
  } catch {
    return null
  }
}

function secureFlag(): string {
  return isProduction ? ' Secure;' : ''
}

export async function createSessionCookie(data: SessionData): Promise<string> {
  const token = await sign(data)
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}${secureFlag()}`
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureFlag()}`
}

export function getCookieExpiry(): number {
  return Date.now() + MAX_AGE * 1000
}

export async function getSessionFromCookie(cookieHeader: string | null): Promise<SessionData | null> {
  if (!cookieHeader) return null
  try {
    for (const part of cookieHeader.split(';')) {
      const [name, ...rest] = part.trim().split('=')
      if (name === COOKIE_NAME) {
        return await verify(rest.join('='))
      }
    }
  } catch (err) {
    console.error('[session] getSessionFromCookie failed:', err)
  }
  return null
}
