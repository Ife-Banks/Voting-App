'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function SetupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [valid, setValid] = useState<'loading' | 'valid' | 'invalid'>('loading')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setValid('invalid')
      return
    }
    fetch('/api/admin/check-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setValid('valid')
          setEmail(data.email)
          setName(data.name)
        } else {
          setValid('invalid')
        }
      })
      .catch(() => setValid('invalid'))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setSubmitting(true)

    const res = await fetch('/api/admin/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })

    const data = await res.json()
    setSubmitting(false)

    if (data.success) {
      setSuccess(true)
    } else {
      setError(data.error || 'Something went wrong')
    }
  }

  if (valid === 'loading') {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
        <p className="text-gray-400">Verifying invite link...</p>
      </div>
    )
  }

  if (valid === 'invalid') {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
        <div className="bg-[#13131A] border border-[#20203A] rounded-xl p-8 max-w-md w-full text-center">
          <div className="text-red-400 text-5xl mb-4">!</div>
          <h1 className="text-xl font-bold text-white mb-2">Invalid or Expired Link</h1>
          <p className="text-gray-400 text-sm">
            This invite link is invalid or has expired. Contact your Super Admin for a new invitation.
          </p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
        <div className="bg-[#13131A] border border-[#20203A] rounded-xl p-8 max-w-md w-full text-center">
          <div className="text-green-400 text-5xl mb-4">&#10003;</div>
          <h1 className="text-xl font-bold text-white mb-2">Password Set!</h1>
          <p className="text-gray-400 text-sm mb-6">
            Your admin account is ready. You can now log in.
          </p>
          <button
            onClick={() => router.push('/admin/login')}
            className="w-full px-6 py-3 bg-[#C9A84C] text-[#0A0A0F] rounded-xl font-semibold hover:bg-[#B8943F] transition-colors cursor-pointer"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
      <div className="bg-[#13131A] border border-[#20203A] rounded-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-white mb-1">Set Up Password</h1>
        <p className="text-gray-400 text-sm mb-6">
          Hello {name || email}, choose a password for your admin account.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-4 py-3 bg-[#1A1A24] border border-[#20203A] rounded-xl text-white opacity-60 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-4 py-3 bg-[#1A1A24] border border-[#20203A] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat password"
              className="w-full px-4 py-3 bg-[#1A1A24] border border-[#20203A] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]"
              required
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full px-6 py-3 bg-[#C9A84C] text-[#0A0A0F] rounded-xl font-semibold hover:bg-[#B8943F] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Setting up...' : 'Set Password & Login'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AdminSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
        <p className="text-gray-400">Loading...</p>
      </div>
    }>
      <SetupForm />
    </Suspense>
  )
}
