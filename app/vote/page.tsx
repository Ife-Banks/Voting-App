'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Position, VoteSelection } from '@/lib/types'
import { CheckCircle2, ChevronRight, ChevronLeft, LogOut, AlertCircle, Loader2, User, Trophy } from 'lucide-react'
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
  const [resultsPublic, setResultsPublic] = useState(false)
  const [electionName, setElectionName] = useState('NACOS Executive Elections')
  const [alreadyVoted, setAlreadyVoted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function init() {
      try {
        // Check session via API
        const res = await fetch('/api/auth/me')
        if (!res.ok) {
          router.push('/login')
          return
        }

        const data = await res.json()
        if (!data?.user) {
          router.push('/login')
          return
        }

        // Redirect admin
        if (data.type === 'admin') {
          router.push('/admin/dashboard')
          return
        }

        setUserEmail(data.user.email)

        // Check settings
        const { data: settings } = await supabase.from('settings').select('*').single()
        if (settings) {
          setVotingOpen(settings.voting_open)
          setResultsPublic(settings.results_public ?? false)
          setElectionName(settings.election_name)
        }

        // Check if already voted, but allow if results are public so they can still view results
        const statusRes = await fetch('/api/student/status')
        const statusData = await statusRes.json()
        const hasVoted = statusData?.has_voted
        const rp = settings?.results_public ?? false

        if (hasVoted && !rp && settings?.voting_open) {
          setAlreadyVoted(true)
          setLoading(false)
          setTimeout(async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            window.location.href = '/login'
          }, 3000)
          return
        }

        // If results_public=true, don't block on has_voted and allow them to see results
        const { data: posData } = await supabase
          .from('positions')
          .select('*, candidates(*)')
          .order('display_order')

        if (posData) setPositions(posData)
        setLoading(false)
      } catch {
        if (!cancelled) {
          router.push('/login')
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  function selectCandidate(positionId: string, candidateId: string) {
    setSelections(prev => ({ ...prev, [positionId]: candidateId }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')

    const voteRows = positions
      .map(pos => ({
        student_email: userEmail,
        position_id: pos.id,
        candidate_id: selections[pos.id] ?? null,
      }))
      .filter(v => v.candidate_id)

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ votes: voteRows, email: userEmail }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      setSubmitted(true)
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
        <Loader2 size={32} className="animate-spin" style={{ color: '#4CAF50' }} />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="page-shell min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
            style={{ background: 'linear-gradient(135deg, #1A1A2E, #2A2A3E)', border: '2px solid #4CAF50' }}>
            <CheckCircle2 size={40} style={{ color: '#4CAF50' }} />
          </div>
          <h1 className="text-3xl font-display font-bold gold-text mb-3">
            Vote Submitted!
          </h1>
          <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Your vote has been successfully recorded.
          </p>
          <p className="text-xs mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Thank you for participating in the {electionName}.
          </p>
          <button onClick={handleLogout} className="btn-ghost px-8 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    )
  }

  if (alreadyVoted) {
    return (
      <div className="page-shell min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-8"
            style={{ background: 'linear-gradient(135deg, #1A1A2E, #2A2A3E)', border: '2px solid #4CAF50' }}>
            <CheckCircle2 size={48} style={{ color: '#4CAF50' }} />
          </div>
          <h1 className="text-4xl font-display font-bold gold-text mb-4">
            Already Voted
          </h1>
          <p className="text-lg mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
            You have already cast your vote in this election.
          </p>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Thank you for participating in the {electionName}.
          </p>
          <button onClick={handleLogout} className="btn-ghost px-8 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    )
  }

  if (!votingOpen) {
    if (resultsPublic) {
      return (
        <div className="page-shell min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
              style={{ background: 'rgba(58,58,80,0.1)', border: '1px solid rgba(58,58,80,0.2)' }}>
              <Trophy size={36} style={{ color: '#4CAF50' }} />
            </div>
            <h1 className="text-3xl font-display font-bold mb-4" style={{ color: '#FFFFFF' }}>
              Voting Has Ended
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)' }} className="mb-6">
              Results are now available. Click below to view.
            </p>
            <a href="/results" className="btn-gold px-8 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto w-fit">
              <Trophy size={16} /> View Results
            </a>
            <button onClick={handleLogout} className="btn-ghost px-8 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto mt-4">
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="page-shell min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
            style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)' }}>
            <AlertCircle size={36} style={{ color: '#4CAF50' }} />
          </div>
          <h1 className="text-3xl font-display font-bold mb-4" style={{ color: '#FFFFFF' }}>
            Results Not Out Yet
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)' }} className="mb-6">
            Voting has closed. Results will be announced soon.
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
    <div className="page-shell min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b"
        style={{ borderColor: 'rgba(212,168,67,0.15)', background: 'rgba(10,10,15,0.82)', backdropFilter: 'blur(18px)' }}>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 shrink-0">
              <Image src="/image.png" alt="Logo" fill className="object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold green-text truncate">{electionName}</h1>
              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{userEmail}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-ghost px-4 py-2 rounded-lg text-xs flex items-center gap-2 w-full sm:w-auto">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="glass-card mb-6 p-4 rounded-2xl flex items-start gap-3"
          style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.25)' }}>
          <AlertCircle size={18} style={{ color: '#4CAF50', marginTop: 2 }} />
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <strong style={{ color: '#4CAF50' }}>One-time access:</strong> Do not log out until you have voted.
            If you leave or refresh this page before submitting, you will not be able to re-enter.
          </p>
        </div>

        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Position {currentStep + 1} of {totalSteps}
            </span>
            <span className="text-sm" style={{ color: '#4CAF50' }}>
              {Object.keys(selections).length}/{totalSteps} selected
            </span>
          </div>
          <div className="flex gap-2">
            {positions.map((pos, i) => (
              <button
                key={pos.id}
                onClick={() => setCurrentStep(i)}
                className="step-dot flex-1 h-1.5 rounded-full cursor-pointer"
                style={{
                  background: i < currentStep
                    ? '#3A3A50'
                    : i === currentStep
                      ? '#4CAF50'
                      : selections[pos.id]
                        ? '#2A2A3E'
                        : 'rgba(212,168,67,0.15)',
                  maxWidth: '100%',
                  height: '4px',
                  borderRadius: '2px',
                }}
              />
            ))}
          </div>
        </div>

        {currentPosition && (
          <div className="animate-fade-up">
            <div className="mb-8">
              <h2 className="text-3xl font-display font-bold mb-2" style={{ color: '#FFFFFF' }}>
                {currentPosition.title}
              </h2>
              {currentPosition.description && (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {currentPosition.description}
                </p>
              )}
              <p className="text-xs mt-2" style={{ color: 'rgba(212,168,67,0.7)' }}>
                Select one candidate below
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 mb-8">
              {(currentPosition.candidates ?? []).map(candidate => {
                const isSelected = selections[currentPosition.id] === candidate.id

                return (
                  <div
                    key={candidate.id}
                    className={`candidate-card glass-card rounded-2xl overflow-hidden ${isSelected ? 'selected' : ''}`}
                    onClick={() => selectCandidate(currentPosition.id, candidate.id)}
                  >
                    <div className="h-48 relative overflow-hidden bg-[#1A1A2E]">
                      {candidate.photo_url ? (
                        <>
                          <img
                            src={candidate.photo_url}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-60"
                          />
                          <div className="absolute inset-0 flex items-center justify-center p-6">
                            <Image
                              src={candidate.photo_url}
                              alt={candidate.full_name}
                              width={200}
                              height={200}
                              className="object-contain w-auto h-auto max-w-full max-h-full rounded-lg shadow-2xl"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <User size={64} className="opacity-30" style={{ color: '#D4A843' }} />
                        </div>
                      )}
                      {isSelected && (
                        <div
                          className="absolute inset-0 flex items-end p-4 pointer-events-none"
                          style={{ background: 'linear-gradient(to top, rgba(212,168,67,0.3), transparent)' }}
                        />
                      )}
                    </div>

                    <div className="p-4">
                      <h3 className="font-display text-lg font-semibold mb-1" style={{ color: '#FFFFFF' }}>
                        {candidate.full_name}
                      </h3>
                      {candidate.class && (
                        <p className="text-xs mb-2" style={{ color: '#4CAF50' }}>
                          {candidate.class}
                        </p>
                      )}
                      {candidate.manifesto && (
                        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {candidate.manifesto.length > 120
                            ? `${candidate.manifesto.slice(0, 120)}...`
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => setCurrentStep(s => s - 1)}
            disabled={currentStep === 0}
            className="btn-ghost px-5 py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-30"
          >
            <ChevronLeft size={16} /> Previous
          </button>

          {isLastStep ? (
            <div className="flex flex-col items-end gap-3">
              {error && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={12} /> {error}
                </p>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting || !allVoted}
                className="btn-gold px-8 py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {submitting
                  ? <><Loader2 size={16} className="animate-spin" /> Submitting&hellip;</>
                  : <><CheckCircle2 size={16} /> Submit All Votes</>}
              </button>
              {!allVoted && (
                <p className="text-xs" style={{ color: 'rgba(76,175,80,0.6)' }}>
                  Please vote for all positions before submitting
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setCurrentStep(s => s + 1)}
              className="btn-gold px-5 py-3 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
