'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Candidate, Settings } from '@/lib/types'
import { Loader2, User, ChevronRight, Minus, Plus, ArrowLeft, CheckCircle, XCircle, TrendingUp } from 'lucide-react'
import Link from 'next/link'

declare const PaystackPop: any

export default function VotePage() {
  const params = useParams()
  const slug = params.slug as string

  const [position, setPosition] = useState<any>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [votingOpen, setVotingOpen] = useState(true)

  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [voterName, setVoterName] = useState('')
  const [voterEmail, setVoterEmail] = useState('')
  const [processing, setProcessing] = useState(false)
  const [paystackReady, setPaystackReady] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  // Poll until Paystack script finishes loading
  useEffect(() => {
    if (typeof PaystackPop !== 'undefined') { setPaystackReady(true); return }
    const check = setInterval(() => {
      if (typeof PaystackPop !== 'undefined') {
        setPaystackReady(true)
        clearInterval(check)
      }
    }, 200)
    const timeout = setTimeout(() => clearInterval(check), 8000)
    return () => { clearInterval(check); clearTimeout(timeout) }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: posData } = await supabase
        .from('positions')
        .select('*, candidates(*)')
        .eq('slug', slug)
        .single()
      const { data: s } = await supabase.from('settings').select('*').single()

      if (posData) {
        setPosition(posData)
        setCandidates(posData.candidates ?? [])
      }
      if (s) {
        setSettings(s)
        setVotingOpen(s.award_open)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  // Realtime subscription for live vote count
  useEffect(() => {
    if (!position) return
    const supabase = createClient()
    const channel = supabase
      .channel('candidates-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'candidates', filter: `position_id=eq.${position.id}` },
        (payload) => {
          const updated = payload.new as Candidate
          setCandidates(prev => prev.map(c => c.id === updated.id ? updated : c))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [position])

  const selectedCandidateData = candidates.find(c => c.id === selectedCandidate)

  async function handlePay() {
    if (!selectedCandidate || !voterName.trim() || !voterEmail.trim() || quantity < 1) return
    setProcessing(true)
    setResult(null)
    console.log('[pay] starting — paystackReady:', paystackReady)

    try {
      console.log('[pay] calling POST /api/payments/initiate')
      const initRes = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: selectedCandidate,
          quantity,
          voter_name: voterName.trim(),
          voter_email: voterEmail.trim(),
        }),
      })
      console.log('[pay] initiate responded with status', initRes.status)
      const initData = await initRes.json()
      if (!initRes.ok) {
        setResult({ success: false, message: initData.error ?? 'Failed to initiate payment' })
        setProcessing(false)
        return
      }

      const { amount_kobo, reference } = initData
      console.log('[pay] payment initiated:', { amount_kobo, reference })

      const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
      if (!publicKey) {
        setResult({ success: false, message: 'Payment not configured' })
        setProcessing(false)
        return
      }

      if (typeof PaystackPop === 'undefined') {
        console.error('[pay] PaystackPop not loaded')
        setResult({ success: false, message: 'Payment system not yet loaded. Please wait a moment and try again.' })
        setProcessing(false)
        return
      }

      console.log('[pay] opening Paystack popup')
      const handler = PaystackPop.setup({
        key: publicKey,
        email: voterEmail.trim(),
        amount: amount_kobo,
        ref: reference,
        onClose: () => {
          console.log('[pay] popup closed by user')
          setProcessing(false)
        },
        callback: (response: any) => {
          console.log('[pay] popup callback fired, reference:', response.reference)
          setProcessing(false)
          fetch(`/api/payments/verify?reference=${response.reference}`)
            .then(r => r.json())
            .then(verifyData => {
              if (verifyData.success || verifyData.already_processed) {
                setResult({ success: true, message: `Vote cast successfully! You bought ${quantity} vote${quantity > 1 ? 's' : ''}.` })
                setQuantity(1)
                setVoterName('')
                setVoterEmail('')
                setSelectedCandidate(null)
              } else {
                setResult({ success: false, message: 'Payment verification failed. Vote will be counted via webhook.' })
              }
            })
            .catch(() => {
              setResult({ success: false, message: 'Payment verification failed. Vote will be counted via webhook.' })
            })
        },
      })
      handler.openIframe()
      console.log('[pay] openIframe() called')
    } catch (err) {
      console.error('[pay] hard failure:', err)
      setResult({ success: false, message: `Something went wrong: ${err instanceof Error ? err.message : String(err)}` })
      setProcessing(false)
    }
  }

  const priceInNaira = settings ? (settings.price_per_vote_kobo / 100).toFixed(0) : '100'
  const totalNaira = ((quantity * (settings?.price_per_vote_kobo ?? 10000)) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (loading) {
    return (
      <div className="page-shell min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin" style={{ color: '#4CAF50' }} />
      </div>
    )
  }

  if (!position) {
    return (
      <div className="page-shell min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>Category not found</p>
          <Link href="/awards" className="btn-ghost mt-4 px-5 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">
            <ArrowLeft size={14} /> Back to Categories
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell min-h-screen flex flex-col">
      <header className="border-b" style={{ borderColor: 'rgba(212,168,67,0.15)', background: 'rgba(10,10,15,0.82)', backdropFilter: 'blur(18px)' }}>
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/awards" className="p-2 -ml-2 rounded-lg hover:bg-white/5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-semibold gold-text truncate">{position.title}</h1>
            {position.description && (
              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{position.description}</p>
            )}
          </div>
          <Link href="/leaderboard" className="ml-auto btn-ghost px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 shrink-0">
            <TrendingUp size={12} /> Live Leaderboard
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {!votingOpen && (
          <div className="glass-card rounded-2xl p-8 text-center mb-8">
            <p className="text-lg font-display font-semibold gold-text">Voting has closed</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Check the leaderboard to see the final standings.
            </p>
            <Link href="/leaderboard" className="btn-gold mt-4 px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">
              View Leaderboard
            </Link>
          </div>
        )}

        <div className="grid gap-4">
          {candidates.map(candidate => {
            const sorted = [...candidates].sort((a, b) => b.vote_count - a.vote_count)
            const pos = sorted.findIndex(c => c.id === candidate.id) + 1
            const isSelected = selectedCandidate === candidate.id

            return (
              <div key={candidate.id}
                className={`glass-card rounded-2xl overflow-hidden transition-all ${isSelected ? 'ring-2 ring-[#4CAF50]' : ''} ${votingOpen ? 'cursor-pointer hover:bg-white/5' : ''}`}
                onClick={() => { if (votingOpen) setSelectedCandidate(candidate.id) }}>
                <div className="flex items-start gap-4 p-4 sm:p-6">
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0"
                    style={{ background: 'linear-gradient(135deg, #1A1A2E, #0A1A0A)' }}>
                    {candidate.photo_url ? (
                      <img src={candidate.photo_url} alt={candidate.full_name} className="w-full h-full object-cover object-top" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User size={24} style={{ color: 'rgba(212,168,67,0.3)' }} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(76,175,80,0.15)', color: '#4CAF50' }}>
                        #{pos}
                      </span>
                      <h3 className="font-display font-semibold" style={{ color: '#FFFFFF' }}>{candidate.full_name}</h3>
                    </div>
                    {candidate.bio && (
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{candidate.bio}</p>
                    )}
                    <p className="text-sm font-bold mt-2" style={{ color: '#4CAF50' }}>
                      {candidate.vote_count} vote{candidate.vote_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {isSelected && (
                    <CheckCircle size={20} style={{ color: '#4CAF50' }} className="shrink-0" />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Payment form */}
        {votingOpen && (
          <div className="glass-card rounded-2xl p-5 sm:p-6 mt-8">
            <h3 className="font-display text-lg font-semibold mb-4" style={{ color: '#FFFFFF' }}>
              {selectedCandidateData ? `Vote for ${selectedCandidateData.full_name}` : 'Select a candidate to vote'}
            </h3>

            {selectedCandidate ? (
              <form onSubmit={(e) => { e.preventDefault(); handlePay() }} className="space-y-4">
                {/* Quantity stepper */}
                <div>
                  <label className="block text-xs mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>Number of Votes</label>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 rounded-xl flex items-center justify-center btn-ghost">
                      <Minus size={16} />
                    </button>
                    <input type="number" min={1} value={quantity}
                      onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="input-field w-20 text-center px-3 py-2.5 rounded-xl text-lg font-bold" />
                    <button type="button" onClick={() => setQuantity(quantity + 1)}
                      className="w-10 h-10 rounded-xl flex items-center justify-center btn-ghost">
                      <Plus size={16} />
                    </button>
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      at ₦{priceInNaira}/vote
                    </span>
                  </div>
                </div>

                {/* Voter details */}
                <div>
                  <label className="block text-xs mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>Your Name</label>
                  <input value={voterName} onChange={e => setVoterName(e.target.value)}
                    className="input-field w-full px-4 py-3 rounded-xl text-sm" placeholder="Enter your name" />
                </div>
                <div>
                  <label className="block text-xs mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>Your Email</label>
                  <input type="email" value={voterEmail} onChange={e => setVoterEmail(e.target.value)}
                    className="input-field w-full px-4 py-3 rounded-xl text-sm" placeholder="email@example.com" />
                </div>

                {/* Total & pay button */}
                <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.15)' }}>
                  <div>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Total</p>
                    <p className="text-2xl font-display font-bold gold-text">₦{totalNaira}</p>
                  </div>
                  <button type="submit" disabled={processing || !paystackReady || !voterName.trim() || !voterEmail.trim()}
                    className="btn-gold px-8 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
                    {processing ? <Loader2 size={16} className="animate-spin" /> : null}
                    {!paystackReady ? 'Loading payment system\u2026' : processing ? 'Processing...' : `Pay ₦${totalNaira}`}
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Click on a candidate card above to start voting.
              </p>
            )}

            {result && (
              <div className={`mt-4 p-4 rounded-xl flex items-center gap-3 ${result.success ? 'bg-green-900/20 border border-green-700/30' : 'bg-red-900/20 border border-red-700/30'}`}>
                {result.success ? <CheckCircle size={18} style={{ color: '#4CAF50' }} /> : <XCircle size={18} style={{ color: '#E74C3C' }} />}
                <p className="text-sm" style={{ color: result.success ? '#4CAF50' : '#E74C3C' }}>{result.message}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
