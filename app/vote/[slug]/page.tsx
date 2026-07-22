'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useSessionStorage } from '@/lib/use-session-storage'
import type { Candidate, Settings } from '@/lib/types'
import { Loader2, User, Minus, Plus, ArrowLeft, CheckCircle, XCircle, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const FlutterwaveCheckout = dynamic(() => import('@/components/flutterwave-checkout'), { ssr: false })

export default function VotePage() {
  const params = useParams()
  const slug = params.slug as string

  const [position, setPosition] = useState<any>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [votingOpen, setVotingOpen] = useState(true)

  const [selectedCandidate, setSelectedCandidate] = useSessionStorage<string | null>(`vote:${slug}:candidate`, null)
  const [quantity, setQuantity] = useSessionStorage<number>(`vote:${slug}:quantity`, 1)
  const [voterName, setVoterName] = useSessionStorage<string>(`vote:${slug}:name`, '')
  const [voterEmail, setVoterEmail] = useSessionStorage<string>(`vote:${slug}:email`, '')
  const [voterPhone, setVoterPhone] = useSessionStorage<string>(`vote:${slug}:phone`, '')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [paymentConfig, setPaymentConfig] = useState<{ tx_ref: string; amount_naira: number; payment_options: string } | null>(null)

  const publicKey = process.env.NEXT_PUBLIC_FLW_PUBLIC_KEY ?? ''

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

  function onCheckoutSuccess(transactionId: number) {
    setProcessing(false)
    const pc = paymentConfig
    if (!pc) return
    const qty = quantity
    fetch(`/api/payments/verify?transaction_id=${transactionId}&reference=${pc.tx_ref}`)
      .then(r => r.json())
      .then(verifyData => {
        if (verifyData.success || verifyData.already_processed) {
          const was = verifyData.channel
          const isNonCard = was && was !== 'card'
          setResult({ success: true, message: isNonCard
            ? `Payment received — confirming with your bank, your ${qty} vote${qty > 1 ? 's' : ''} will appear shortly.`
            : `Vote cast successfully! You bought ${qty} vote${qty > 1 ? 's' : ''}.` })
          setQuantity(1)
          setVoterName('')
          setVoterEmail('')
          setVoterPhone('')
          setSelectedCandidate(null)
          sessionStorage.removeItem(`vote:${slug}:candidate`)
          sessionStorage.removeItem(`vote:${slug}:quantity`)
          sessionStorage.removeItem(`vote:${slug}:name`)
          sessionStorage.removeItem(`vote:${slug}:email`)
          sessionStorage.removeItem(`vote:${slug}:phone`)
        } else {
          setResult({ success: true, message: 'Payment received — vote will appear shortly.' })
        }
        setPaymentConfig(null)
      })
      .catch(() => {
        setResult({ success: true, message: 'Payment received — vote will appear shortly.' })
        setPaymentConfig(null)
      })
  }

  function onCheckoutClose() {
    setProcessing(false)
    setPaymentConfig(null)
  }

  async function handleInitiate() {
    if (!selectedCandidate || !voterName.trim() || !voterEmail.trim() || quantity < 1) return
    setProcessing(true)
    setResult(null)

    try {
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
      const initData = await initRes.json()
      if (!initRes.ok) {
        setResult({ success: false, message: initData.error ?? 'Failed to initiate payment' })
        setProcessing(false)
        return
      }

      setPaymentConfig({
        tx_ref: initData.tx_ref,
        amount_naira: initData.amount_naira,
        payment_options: initData.payment_options,
      })
    } catch {
      setResult({ success: false, message: 'Something went wrong starting payment.' })
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
          <Link href="/leaderboard" className="ml-auto btn-ghost px-3 sm:px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 shrink-0">
            <TrendingUp size={12} /> <span className="hidden sm:inline">Live Leaderboard</span>
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
                <div className="flex items-start gap-3 p-3 sm:p-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0"
                    style={{ background: 'linear-gradient(135deg, #1A1A2E, #0A1A0A)' }}>
                    {candidate.photo_url ? (
                      <img src={candidate.photo_url} alt={candidate.full_name} className="w-full h-full object-cover object-top" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User size={20} style={{ color: 'rgba(212,168,67,0.3)' }} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(76,175,80,0.15)', color: '#4CAF50' }}>
                        #{pos}
                      </span>
                      <h3 className="font-display font-semibold text-sm sm:text-base truncate" style={{ color: '#FFFFFF' }}>{candidate.full_name}</h3>
                    </div>
                    {candidate.bio && (
                      <p className="text-[11px] sm:text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{candidate.bio}</p>
                    )}
                    <p className="text-xs sm:text-sm font-bold mt-1.5" style={{ color: '#4CAF50' }}>
                      {candidate.vote_count} vote{candidate.vote_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {isSelected && (
                    <CheckCircle size={18} style={{ color: '#4CAF50' }} className="shrink-0" />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Payment form */}
        {votingOpen && (
          <div className="glass-card rounded-2xl p-4 sm:p-6 mt-8">
            <h3 className="font-display text-lg font-semibold mb-4" style={{ color: '#FFFFFF' }}>
              {selectedCandidateData ? `Vote for ${selectedCandidateData.full_name}` : 'Select a candidate to vote'}
            </h3>

            {selectedCandidate ? (
              <form onSubmit={(e) => { e.preventDefault(); handleInitiate() }} className="space-y-4">
                {/* Quantity stepper */}
                <div>
                  <label className="block text-xs mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>Number of Votes</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center btn-ghost">
                        <Minus size={16} />
                      </button>
                      <input type="number" min={1} value={quantity}
                        onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="input-field w-16 sm:w-20 text-center px-2 py-2 rounded-xl text-base sm:text-lg font-bold" />
                      <button type="button" onClick={() => setQuantity(quantity + 1)}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center btn-ghost">
                        <Plus size={16} />
                      </button>
                    </div>
                    <span className="text-xs sm:text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
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
                <div>
                  <label className="block text-xs mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>Phone Number</label>
                  <input type="tel" value={voterPhone} onChange={e => setVoterPhone(e.target.value)}
                    className="input-field w-full px-4 py-3 rounded-xl text-sm" placeholder="08012345678" />
                </div>

                {/* Total & pay button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl" style={{ background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.15)' }}>
                  <div>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Total</p>
                    <p className="text-xl sm:text-2xl font-display font-bold gold-text">₦{totalNaira}</p>
                  </div>
                  <button type="submit" disabled={processing || !voterName.trim() || !voterEmail.trim()}
                    className="btn-gold px-6 sm:px-8 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 w-full sm:w-auto justify-center">
                    {processing ? <Loader2 size={16} className="animate-spin" /> : null}
                    {processing ? 'Processing...' : `Pay ₦${totalNaira}`}
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

      {paymentConfig && (
        <FlutterwaveCheckout
          publicKey={publicKey}
          email={voterEmail.trim()}
          name={voterName.trim()}
          phone_number={voterPhone.trim() || '00000000000'}
          amount_naira={paymentConfig.amount_naira}
          tx_ref={paymentConfig.tx_ref}
          payment_options={paymentConfig.payment_options}
          onSuccess={onCheckoutSuccess}
          onClose={onCheckoutClose}
        />
      )}
    </div>
  )
}
