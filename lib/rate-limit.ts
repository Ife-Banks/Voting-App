const store = new Map<string, { count: number; resetAt: number }>()

const WINDOW_MS = 60_000

const limits: Record<string, number> = {
  login: 5,
  vote: 20,
  default: 10,
}

export function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const prefix = key.split(':')[0]
  const max = limits[prefix] ?? limits.default
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: max - 1, resetAt: now + WINDOW_MS }
  }

  entry.count++
  if (entry.count > max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt }
}
