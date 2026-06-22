'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Shield, Vote, AlertCircle, Loader2, Hash } from 'lucide-react'

export default function LoginPage() {
  const [matric_number, setMatricNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState<{ election_name: string; school_name: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.from('settings').select('election_name, school_name').single()
      .then(({ data }) => data && setSettings(data))

    const controller = new AbortController()

    fetch('/api/auth/me', { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          const dest = data.type === 'admin' ? '/admin/dashboard' : '/vote'
          router.replace(dest)
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('[Login] /api/auth/me fetch failed:', err)
        }
      })

    return () => controller.abort()
  }, [])

  async function handleMatricSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matric_number }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to send OTP')
        setLoading(false)
        return
      }

      router.push(`/verify-otp?matric=${encodeURIComponent(matric_number.trim().toUpperCase())}`)
    } catch {
      setError('Connection error. Try again.')
      setLoading(false)
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
            Sign in to vote
          </h2>
          <p className="text-xs mb-6" style={{ color: 'rgba(245,240,232,0.45)' }}>
            Enter your matric number to receive an OTP
          </p>

          {error && (
            <div className="flex items-start gap-3 mb-6 p-4 rounded-xl"
              style={{ background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)' }}>
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleMatricSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(245,240,232,0.7)' }}>
                Matric Number
              </label>
              <input type="text" value={matric_number}
                onChange={e => setMatricNumber(e.target.value.toUpperCase())}
                className="input-field w-full px-4 py-3 rounded-xl text-sm"
                placeholder="e.g. ENG/2020/001" required />
            </div>

            <button type="submit" disabled={loading || !matric_number}
              className="btn-gold w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-2">
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Sending OTP...</>
              ) : (
                <><Hash size={18} /> Send OTP</>
              )}
            </button>
          </form>

          <p className="text-center mt-6">
            <a href="/admin/login" className="text-xs hover:underline"
              style={{ color: 'rgba(76,175,80,0.6)' }}>
              <Shield size={12} className="inline mr-1" />Admin sign in
            </a>
          </p>
        </div>

        <p className="text-center text-xs mt-8" style={{ color: 'rgba(245,240,232,0.25)' }}>
          Powered by ESSA Voting System &bull; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}