'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Position, Candidate, VoteSelection } from '@/lib/types'
import { CheckCircle2, ChevronRight, ChevronLeft, LogOut, AlertCircle, Loader2, User } from 'lucide-react'
import Image from 'next/image'

export default function VotePage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [selections, setSelections] = useState<VoteSelection>({})
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [votingOpen, setVotingOpen] = useState(true)
  const [electionName, setElectionName] = useState('SRC Elections')
  const [alreadyVoted, setAlreadyVoted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    async function init() {
      try {
      // Check session via API
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      if (!data?.user) { router.push('/login'); return }

      // Redirect admin
      if (data.type === 'admin') {
        router.push('/admin/dashboard'); return
      }

      setUserEmail(data.user.email)

      // Check settings
      const { data: settings } = await supabase.from('settings').select('*').single()
      if (settings) {
        setVotingOpen(settings.voting_open)
        setElectionName(settings.election_name)
      }

      // Check if already voted
      const { data: student } = await supabase
        .from('students').select('has_voted').eq('email', data.user.email).single()
      if (student?.has_voted) {
        setAlreadyVoted(true); setLoading(false)
        setTimeout(async () => {
          await fetch('/api/auth/logout', { method: 'POST' })
          window.location.href = '/login'
        }, 3000)
        return
      }

      // Load positions with candidates
      const { data: posData } = await supabase
        .from('positions').select('*, candidates(*)').order('display_order')
      if (posData) setPositions(posData)
      setLoading(false)
    } catch {
      if (!cancelled) { router.push('/login') }
    }
    }
    init()
    return () => { cancelled = true }
  }, [])

  function selectCandidate(positionId: string, candidateId: string) {
    setSelections(prev => ({ ...prev, [positionId]: candidateId }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')

    const voteRows = positions.map(pos => ({
      student_email: userEmail,
      position_id: pos.id,
      candidate_id: selections[pos.id] ?? null,
    })).filter(v => v.candidate_id)

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ votes: voteRows, email: userEmail }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      setSubmitted(true)
      setTimeout(async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/login'
      }, 3000)
    } catch (err: any) {
      setError(err.message ?? 'Failed to submit votes. Please try again.')
    }
    setSubmitting(false)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin" style={{ color: '#C9A84C' }} />
      </div>
    )
  }

  // Already voted screen
  if (alreadyVoted || submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-8"
            style={{ background: 'linear-gradient(135deg, #1A4A3A, #2D6B54)', border: '2px solid #C9A84C' }}>
            <CheckCircle2 size={48} style={{ color: '#C9A84C' }} />
          </div>
          <h1 className="text-4xl font-display font-bold gold-text mb-4">
            {submitted ? 'Vote Submitted!' : 'Already Voted'}
          </h1>
          <p className="text-lg mb-2" style={{ color: 'rgba(245,240,232,0.7)' }}>
            {submitted
              ? 'Your votes have been recorded successfully.'
              : 'You have already cast your vote in this election.'}
          </p>
          <p className="text-sm mb-8" style={{ color: 'rgba(245,240,232,0.4)' }}>
            Thank you for participating in the {electionName}.
          </p>
          <button onClick={handleLogout} className="btn-ghost px-8 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    )
  }

  // Voting closed
  if (!votingOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 glass-card">
            <AlertCircle size={36} style={{ color: '#C9A84C' }} />
          </div>
          <h1 className="text-3xl font-display font-bold mb-4" style={{ color: '#F5F0E8' }}>
            Voting is Closed
          </h1>
          <p style={{ color: 'rgba(245,240,232,0.5)' }} className="mb-8">
            The election portal is currently closed. Please check back later or contact your administrator.
          </p>
          <button onClick={handleLogout} className="btn-ghost px-8 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    )
  }

  const currentPosition = positions[currentStep]
  const totalSteps = positions.length
  const isLastStep = currentStep === totalSteps - 1
  const allVoted = positions.every(p => selections[p.id])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: 'rgba(201,168,76,0.15)', background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(12px)' }}>
        <div>
          <h1 className="font-display text-xl font-semibold gold-text">{electionName}</h1>
          <p className="text-xs" style={{ color: 'rgba(245,240,232,0.4)' }}>{userEmail}</p>
        </div>
        <button onClick={handleLogout} className="btn-ghost px-4 py-2 rounded-lg text-xs flex items-center gap-2">
          <LogOut size={14} /> Sign Out
        </button>
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {/* One-time login warning */}
        <div className="mb-6 p-4 rounded-xl flex items-start gap-3"
          style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)' }}>
          <AlertCircle size={18} style={{ color: '#C9A84C', marginTop: 2 }} />
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(245,240,232,0.7)' }}>
            <strong style={{ color: '#C9A84C' }}>One-time access:</strong> Do not log out until you have voted. 
            If you leave or refresh this page before submitting, you will not be able to re-enter.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: 'rgba(245,240,232,0.6)' }}>
              Position {currentStep + 1} of {totalSteps}
            </span>
            <span className="text-sm" style={{ color: '#C9A84C' }}>
              {Object.keys(selections).length}/{totalSteps} selected
            </span>
          </div>
          <div className="flex gap-2">
            {positions.map((pos, i) => (
              <button key={pos.id} onClick={() => setCurrentStep(i)}
                className="step-dot flex-1 h-1.5 rounded-full cursor-pointer"
                style={{
                  background: i < currentStep ? '#3D8A6C'
                    : i === currentStep ? '#C9A84C'
                    : selections[pos.id] ? '#2D6B54'
                    : 'rgba(201,168,76,0.15)',
                  maxWidth: '100%',
                  height: '4px',
                  borderRadius: '2px',
                }} />
            ))}
          </div>
        </div>

        {/* Current position */}
        {currentPosition && (
          <div className="animate-fade-up">
            <div className="mb-8">
              <h2 className="text-3xl font-display font-bold mb-2" style={{ color: '#F5F0E8' }}>
                {currentPosition.title}
              </h2>
              {currentPosition.description && (
                <p className="text-sm" style={{ color: 'rgba(245,240,232,0.5)' }}>{currentPosition.description}</p>
              )}
              <p className="text-xs mt-2" style={{ color: 'rgba(201,168,76,0.7)' }}>
                Select one candidate below
              </p>
            </div>

            {/* Candidates grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {(currentPosition.candidates ?? []).map(candidate => {
                const isSelected = selections[currentPosition.id] === candidate.id
                return (
                  <div key={candidate.id}
                    className={`candidate-card glass-card rounded-2xl overflow-hidden ${isSelected ? 'selected' : ''}`}
                    onClick={() => selectCandidate(currentPosition.id, candidate.id)}>
                    {/* Photo */}
                    <div className="h-48 relative overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #1A4A3A, #0A0A0F)' }}>
                      {candidate.photo_url ? (
                        <Image src={candidate.photo_url} alt={candidate.full_name}
                          fill className="object-cover object-top" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <User size={64} style={{ color: 'rgba(201,168,76,0.3)' }} />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 flex items-end p-4"
                          style={{ background: 'linear-gradient(to top, rgba(201,168,76,0.3), transparent)' }}>
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-display text-lg font-semibold mb-1" style={{ color: '#F5F0E8' }}>
                        {candidate.full_name}
                      </h3>
                      {candidate.class && (
                        <p className="text-xs mb-2" style={{ color: '#C9A84C' }}>{candidate.class}</p>
                      )}
                      {candidate.manifesto && (
                        <p className="text-xs leading-relaxed" style={{ color: 'rgba(245,240,232,0.5)' }}>
                          {candidate.manifesto.length > 120
                            ? candidate.manifesto.slice(0, 120) + '…'
                            : candidate.manifesto}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => setCurrentStep(s => s - 1)} disabled={currentStep === 0}
            className="btn-ghost px-5 py-3 rounded-xl text-sm flex items-center gap-2 disabled:opacity-30">
            <ChevronLeft size={16} /> Previous
          </button>

          {isLastStep ? (
            <div className="flex flex-col items-end gap-3">
              {error && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={12} /> {error}
                </p>
              )}
              <button onClick={handleSubmit} disabled={submitting || !allVoted}
                className="btn-gold px-8 py-3 rounded-xl text-sm flex items-center gap-2 disabled:opacity-40">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting&hellip;</> : <><CheckCircle2 size={16} /> Submit All Votes</>}
              </button>
              {!allVoted && (
                <p className="text-xs" style={{ color: 'rgba(201,168,76,0.6)' }}>
                  Please vote for all positions before submitting
                </p>
              )}
            </div>
          ) : (
            <button onClick={() => setCurrentStep(s => s + 1)}
              className="btn-gold px-5 py-3 rounded-xl text-sm flex items-center gap-2">
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
