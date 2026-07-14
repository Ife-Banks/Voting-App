'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'
import { Shield, Vote, AlertCircle, Loader2, Hash } from 'lucide-react'

export default function LoginPage() {
  const [matricNumber, setMatricNumber] = useState('')
  const [email, setEmail] = useState('')
  const [loginInput, setLoginInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [otpEnabled, setOtpEnabled] = useState(true)
  const [settings, setSettings] = useState<{ election_name: string; school_name: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.from('settings').select('election_name, school_name, otp_enabled').single()
      .then(({ data }) => {
        if (!data) return
        setSettings(data)
        setOtpEnabled(data.otp_enabled !== false)
      })

    const controller = new AbortController()
    fetch('/api/auth/me', { signal: controller.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.user) {
          router.replace(data.type === 'admin' ? '/admin/dashboard' : '/vote')
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.error('[Login] /api/auth/me failed:', err)
      })
    return () => controller.abort()
  }, [])

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginInput }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Could not send OTP')
        setLoading(false)
        return
      }

      if (data.voting_closed) {
        setError('Voting is not currently open. Please try again later.')
        setLoading(false)
        return
      }

      router.push(`/verify-otp?identifier=${encodeURIComponent(loginInput)}`)
    } catch {
      setError('Connection error. Try again.')
      setLoading(false)
    }
  }

  async function handleDirectLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matric_number: matricNumber, email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Login failed')
        setLoading(false)
        return
      }

      window.location.replace('/vote')
    } catch {
      setError('Connection error. Try again.')
      setLoading(false)
    }
  }

  const stepLabels = otpEnabled
    ? ['Enter your matric number or email', 'Check your inbox for the OTP', 'Verify and cast your vote']
    : ['Enter your matric number and email', 'Sign in directly (no code needed)', 'Cast your vote in one session']

  return (
    <div className="page-shell min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 py-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative overflow-hidden rounded-[32px] border border-[rgba(212,168,67,0.12)] bg-[rgba(10,10,15,0.35)] p-6 sm:p-8 lg:p-10 backdrop-blur-xl">
          <div className="absolute inset-0 pointer-events-none opacity-60"
            style={{
              background: 'radial-gradient(circle at top left, rgba(212,168,67,0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(212,168,67,0.1), transparent 30%)',
            }}
          />

          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,168,67,0.18)] bg-white/5 px-4 py-2 text-xs text-[rgba(255,255,255,0.7)]">
              <Vote size={14} style={{ color: '#4CAF50' }} />
              NASSA's Student voting portal
            </div>

            <div className="mt-8 mb-10">
              <div className="relative w-20 h-20 mb-6">
                <Image src="/image.png" alt="Logo" fill className="object-contain rounded-2xl" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-display font-bold green-text mb-3">
                {settings?.election_name ?? 'NASSA Elections'}
              </h1>
              <p className="max-w-lg text-sm sm:text-base" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {settings?.school_name ?? ' Student Elections Portal'}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {stepLabels.map((item, index) => (
                <div key={item} className="glass-card rounded-2xl p-4">
                  <p className="text-xs mb-2" style={{ color: 'rgba(212,168,67,0.7)' }}>0{index + 1}</p>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="glass-card rounded-[32px] p-6 sm:p-8">
            <h2 className="text-xl font-display font-semibold mb-2" style={{ color: '#FFFFFF' }}>
              {otpEnabled ? 'Sign in with OTP' : 'Sign in with credentials'}
            </h2>
            <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {otpEnabled
                ? 'Enter your matric number or email to receive a one-time code'
                : 'Enter both your matric number and registered email'}
            </p>

            {error && (
              <div className="flex items-start gap-3 mb-6 p-4 rounded-xl"
                style={{ background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)' }}>
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {otpEnabled ? (
              <form onSubmit={handleRequestOtp} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Matric Number or Email
                  </label>
                  <input
                    type="text"
                    value={loginInput}
                    onChange={e => setLoginInput(e.target.value.toUpperCase())}
                    className="input-field w-full px-4 py-3 rounded-xl text-sm"
                    placeholder="e.g. 125/22/1/0018 or student@email.com"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !loginInput}
                  className="btn-gold w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /> Sending code...</>
                  ) : (
                    <><Hash size={18} /> Request OTP</>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleDirectLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Matric Number
                  </label>
                  <input
                    type="text"
                    value={matricNumber}
                    onChange={e => setMatricNumber(e.target.value.toUpperCase())}
                    className="input-field w-full px-4 py-3 rounded-xl text-sm"
                    placeholder="e.g. 125/22/1/0018"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input-field w-full px-4 py-3 rounded-xl text-sm"
                    placeholder="student@aaju.edu.ng"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !matricNumber || !email}
                  className="btn-gold w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /> Signing in...</>
                  ) : (
                    <><Hash size={18} /> Sign In</>
                  )}
                </button>
              </form>
            )}

            <p className="text-center mt-6">
              <a
                href="/admin/login"
                className="text-xs hover:underline"
                style={{ color: 'rgba(76,175,80,0.6)' }}
              >
                <Shield size={12} className="inline mr-1" />Admin sign in
              </a>
            </p>
          </div>

          <p className="text-center text-xs mt-8" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Powered by NASSA Voting System &bull; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
