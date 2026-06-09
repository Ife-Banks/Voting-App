const LOG_PREFIX = '[src-vote]'

export function logAuth(action: string, email: string, detail: string) {
  const ts = new Date().toISOString()
  console.log(`${LOG_PREFIX} AUTH ${ts} ${action} ${email} ${detail}`)
}

export function logError(context: string, operation: string, message: string) {
  const ts = new Date().toISOString()
  console.error(`${LOG_PREFIX} ERROR ${ts} ${context}/${operation} ${message}`)
}

export function logAPI(method: string, path: string, status: number, ip?: string) {
  const ts = new Date().toISOString()
  console.log(`${LOG_PREFIX} API ${ts} ${method} ${path} ${status} ${ip ?? '-'}`)
}
