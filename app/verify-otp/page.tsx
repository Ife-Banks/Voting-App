'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Vote, AlertCircle, Loader2, Shield, Timer } from 'lucide-react'

export default function VerifyOtpPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [settings, setSettings] = useState<{ election_name: string; school_name: string } | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const matric_number = searchParams.get('matric') ?? ''
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('settings').select('election_name, school_name').single()
      .then(({ data }) => data && setSettings(data))

    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          router.replace(data.type === 'admin' ? '/admin/dashboard' : '/vote')
        }
      })
      .catch(() => {})

    if (!matric_number) {
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
        body: JSON.stringify({ matric_number, otp_code: otpCode }),
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
        body: JSON.stringify({ matric_number }),
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #1A4A3A, transparent)' }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #4CAF50, transparent)' }} />
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(76,175,80,0.1) 60px, rgba(76,175,80,0.1) 61px), repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(76,175,80,0.1) 60px, rgba(76,175,80,0.1) 61px)'
          }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-10 animate-fade-up">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
            style={{ background: 'linear-gradient(135deg, #1A4A3A, #2D6B54)', border: '1px solid rgba(76,175,80,0.3)' }}>
            <Vote size={36} style={{ color: '#4CAF50' }} />
          </div>
          <h1 className="text-4xl font-display font-bold green-text mb-2">
            {settings?.election_name ?? 'ESSA Elections'}
          </h1>
          <p className="text-sm" style={{ color: 'rgba(245,240,232,0.5)' }}>
            {settings?.school_name ?? 'Student Elections Portal'}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8 animate-fade-up delay-2">
          <h2 className="text-xl font-display font-semibold mb-2" style={{ color: '#F5F0E8' }}>
            Enter OTP Code
          </h2>
          <p className="text-xs mb-6" style={{ color: 'rgba(245,240,232,0.45)' }}>
            A 6-digit code was sent to your registered email. It expires in 60 seconds.
          </p>

          <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
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
            className="btn-gold w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Verifying...</>
            ) : (
              <>Verify OTP</>
            )}
          </button>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-xs hover:underline"
              style={{ color: resendCooldown > 0 ? 'rgba(245,240,232,0.3)' : 'rgba(76,175,80,0.6)' }}>
              {resendCooldown > 0 ? (
                <span className="flex items-center gap-1">
                  <Timer size={12} /> Resend in {resendCooldown}s
                </span>
              ) : 'Resend OTP'}
            </button>
            <a href="/login" className="text-xs hover:underline"
              style={{ color: 'rgba(76,175,80,0.6)' }}>
              Use different matric number
            </a>
          </div>
        </div>

        <p className="text-center mt-6">
          <a href="/admin/login" className="text-xs hover:underline"
            style={{ color: 'rgba(76,175,80,0.6)' }}>
            <Shield size={12} className="inline mr-1" />Admin sign in
          </a>
        </p>

        <p className="text-center text-xs mt-8" style={{ color: 'rgba(245,240,232,0.25)' }}>
          Powered by ESSA Voting System &bull; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}