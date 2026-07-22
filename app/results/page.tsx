'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Position } from '@/lib/types'
import { Trophy, Loader2, User, Vote, LogOut, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import ResultsBoard from '@/components/ResultsBoard'

export default function ResultsPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [votingOpen, setVotingOpen] = useState(true)
  const [resultsPublic, setResultsPublic] = useState(false)
  const [electionName, setElectionName] = useState('NACOS Executive Elections')
  const [schoolName, setSchoolName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function init() {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          if (data?.user) setUserEmail(data.user.email)
        }

        const { data: settings } = await supabase
          .from('settings')
          .select('voting_open, results_public, election_name, school_name')
          .single()

        if (cancelled) return

        if (settings) {
          setVotingOpen(settings.voting_open ?? true)
          setResultsPublic(settings.results_public ?? false)
          setElectionName(settings.election_name ?? 'NACOS Executive Elections')
          setSchoolName(settings.school_name ?? '')
        }

        const { data: posData } = await supabase
          .from('positions')
          .select('*, candidates(*)')
          .order('display_order')

        if (cancelled) return
        if (posData) setPositions(posData)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

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

  if (votingOpen) {
    return (
      <div className="page-shell min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
            style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)' }}>
            <AlertCircle size={36} style={{ color: '#4CAF50' }} />
          </div>
          <h1 className="text-3xl font-display font-bold mb-4" style={{ color: '#FFFFFF' }}>
            Voting is Still Open
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)' }} className="mb-8">
            Voting is currently ongoing. Results will be published once voting closes.
          </p>
          {userEmail ? (
            <Link href="/vote" className="btn-gold px-8 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto w-fit">
              <Vote size={16} /> Go to Vote
            </Link>
          ) : (
            <Link href="/login" className="btn-gold px-8 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto w-fit">
              Sign In to Vote
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (!resultsPublic) {
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
          <p style={{ color: 'rgba(255,255,255,0.5)' }} className="mb-8">
            The admin has not published the results yet. Check back soon.
          </p>
          {userEmail ? (
            <Link href="/vote" className="btn-gold px-8 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto w-fit">
              <Vote size={16} /> Go to Vote
            </Link>
          ) : (
            <Link href="/login" className="btn-ghost px-8 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto">
              Sign In
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b"
        style={{ borderColor: 'rgba(212,168,67,0.15)', background: 'rgba(10,10,15,0.82)', backdropFilter: 'blur(18px)' }}>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold gold-text truncate">{electionName}</h1>
            {schoolName && (
              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{schoolName}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {userEmail && (
              <span className="text-xs hidden sm:inline truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {userEmail}
              </span>
            )}
            {userEmail ? (
              <button onClick={handleLogout} className="btn-ghost px-4 py-2 rounded-lg text-xs flex items-center gap-2 w-full sm:w-auto">
                <LogOut size={14} /> Sign Out
              </button>
            ) : (
              <Link href="/login" className="btn-ghost px-4 py-2 rounded-lg text-xs flex items-center gap-2">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)' }}>
            <Trophy size={28} style={{ color: '#4CAF50' }} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold gold-text mb-2">
            Election Results
          </h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {electionName}
          </p>
        </div>

        <ResultsBoard positions={positions} />

        <p className="text-center text-xs mt-10" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Powered by SRC Voting System &bull; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
