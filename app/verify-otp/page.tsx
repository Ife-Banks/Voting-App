'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'
import { Vote, AlertCircle, Loader2, Shield, Timer } from 'lucide-react'

export default function VerifyOtpPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [settings, setSettings] = useState<{ election_name: string; school_name: string } | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const identifier = searchParams.get('identifier') ?? ''
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('settings').select('election_name, school_name').single()
      .then(({ data }) => data && setSettings(data))

    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.user) {
          router.replace(data.type === 'admin' ? '/admin/dashboard' : '/vote')
        }
      })
      .catch(() => {})

    if (!identifier) {
      router.replace('/login')
    }
  }, [])

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newOtp.every(d => d !== '') && newOtp.join('').length === 6) {
      handleVerify(newOtp.join(''))
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const digits = pasted.split('')
      setOtp(digits)
      inputRefs.current[5]?.focus()
      handleVerify(pasted)
    }
  }

  async function handleVerify(otpCode: string) {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp_code: otpCode }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Invalid OTP')
        setOtp(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
        setLoading(false)
        return
      }

      window.location.replace('/vote')
    } catch {
      setError('Connection error. Try again.')
      setLoading(false)
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    setResendCooldown(60)
    setError('')
    setOtp(['', '', '', '', '', ''])

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to resend OTP')
      }
    } catch {
      setError('Failed to resend OTP')
    }
  }

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
              Secure verification
            </div>

            <div className="mt-8 mb-10">
              <div className="relative w-20 h-20 mb-6">
                <Image src="/image.png" alt="Logo" fill className="object-contain rounded-2xl" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-display font-bold green-text mb-3">
                {settings?.election_name ?? 'NACOS Elections'}
              </h1>
              <p className="max-w-lg text-sm sm:text-base" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {settings?.school_name ?? 'Student Elections Portal'}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                'Enter the 6-digit code sent to your email',
                'Use paste or tap through the boxes',
                'You will move to the ballot after verification',
              ].map((item, index) => (
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
              Enter OTP Code
            </h2>
            <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
              A 6-digit code was sent to your registered email. It expires in 60 seconds.
            </p>

            <div className="flex flex-wrap gap-2 justify-center mb-6" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className="input-field w-12 h-14 text-center text-xl font-bold rounded-xl"
                  style={{ color: '#4CAF50' }}
                  disabled={loading}
                />
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-3 mb-4 p-4 rounded-xl"
                style={{ background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)' }}>
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              onClick={() => handleVerify(otp.join(''))}
              disabled={loading || otp.join('').length < 6}
              className="btn-gold w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Verifying...</>
              ) : (
                <>Verify OTP</>
              )}
            </button>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="text-xs hover:underline text-left"
                style={{ color: resendCooldown > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(76,175,80,0.6)' }}>
                {resendCooldown > 0 ? (
                  <span className="flex items-center gap-1">
                    <Timer size={12} /> Resend in {resendCooldown}s
                  </span>
                ) : 'Resend OTP'}
              </button>
              <a href="/login" className="text-xs hover:underline"
                style={{ color: 'rgba(76,175,80,0.6)' }}>
                Use a different email or matric number
              </a>
            </div>
          </div>

          <p className="text-center mt-6">
            <a href="/admin/login" className="text-xs hover:underline"
              style={{ color: 'rgba(76,175,80,0.6)' }}>
              <Shield size={12} className="inline mr-1" />Admin sign in
            </a>
          </p>

          <p className="text-center text-xs mt-8" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Powered by NACOS Voting System &bull; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
