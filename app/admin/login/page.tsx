'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Shield, Vote, AlertCircle, Loader2, Mail, ArrowLeft } from 'lucide-react'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.replace('/admin/dashboard')
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    router.replace('/admin/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #1A4A3A, transparent)' }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #C9A84C, transparent)' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-10 animate-fade-up">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
            style={{ background: 'linear-gradient(135deg, #1A4A3A, #2D6B54)', border: '1px solid rgba(201,168,76,0.3)' }}>
            <Shield size={36} style={{ color: '#C9A84C' }} />
          </div>
          <h1 className="text-3xl font-display font-bold gold-text mb-2">Admin Sign In</h1>
          <p className="text-sm" style={{ color: 'rgba(245,240,232,0.5)' }}>
            Election management panel
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8 animate-fade-up delay-2">
          <h2 className="text-xl font-display font-semibold mb-2" style={{ color: '#F5F0E8' }}>
            Sign in to continue
          </h2>
          <p className="text-xs mb-6" style={{ color: 'rgba(245,240,232,0.45)' }}>
            Enter your admin credentials
          </p>

          {error && (
            <div className="flex items-start gap-3 mb-6 p-4 rounded-xl"
              style={{ background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)' }}>
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(245,240,232,0.7)' }}>
                Email Address
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input-field w-full px-4 py-3 rounded-xl text-sm"
                placeholder="admin@school.edu.ng" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(245,240,232,0.7)' }}>
                Password
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input-field w-full px-4 py-3 rounded-xl text-sm"
                placeholder="Enter admin password" required />
            </div>

            <button type="submit" disabled={loading || !email || !password}
              className="btn-gold w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-2">
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Signing in...</>
              ) : (
                <><Shield size={18} /> Sign In</>
              )}
            </button>
          </form>

          <p className="text-center mt-6">
            <a href="/login" className="text-xs hover:underline"
              style={{ color: 'rgba(201,168,76,0.6)' }}>
              <ArrowLeft size={12} className="inline mr-1" />Back to student sign in
            </a>
          </p>
        </div>

        <p className="text-center text-xs mt-8" style={{ color: 'rgba(245,240,232,0.25)' }}>
          Powered by SRC Voting System &bull; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
