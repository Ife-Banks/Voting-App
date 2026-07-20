'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Position, Settings } from '@/lib/types'
import { Award, Loader2, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function AwardsPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [{ data: pos }, { data: s }] = await Promise.all([
        supabase.from('positions').select('*, candidates(*)').order('display_order'),
        supabase.from('settings').select('*').single(),
      ])
      if (pos) setPositions(pos)
      if (s) setSettings(s)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="page-shell min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin" style={{ color: '#4CAF50' }} />
      </div>
    )
  }

  return (
    <div className="page-shell min-h-screen flex flex-col">
      <header className="border-b" style={{ borderColor: 'rgba(212,168,67,0.15)', background: 'rgba(10,10,15,0.82)', backdropFilter: 'blur(18px)' }}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <h1 className="font-display text-xl font-semibold gold-text">{settings?.award_name ?? 'NASSA Student Choice Award'}</h1>
            {settings?.school_name && (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{settings.school_name}</p>
            )}
          </div>
          <Link href="/leaderboard" className="btn-ghost px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 w-fit">
            Live Leaderboard <ChevronRight size={12} />
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)' }}>
            <Award size={28} style={{ color: '#4CAF50' }} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold gold-text mb-2">Categories</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Select a category to view candidates and vote
          </p>
        </div>

        <div className="grid gap-4">
          {positions.map(position => {
            const totalCandidates = position.candidates?.length ?? 0
            return (
              <Link key={position.id} href={`/vote/${position.slug}`}
                className="glass-card rounded-2xl p-5 sm:p-6 flex items-center gap-4 hover:bg-white/5 transition-all group">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)' }}>
                  <Award size={20} style={{ color: '#4CAF50' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold" style={{ color: '#FFFFFF' }}>{position.title}</h3>
                  {position.description && (
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{position.description}</p>
                  )}
                  <p className="text-xs mt-1" style={{ color: '#4CAF50' }}>
                    {totalCandidates} candidate{totalCandidates !== 1 ? 's' : ''}
                  </p>
                </div>
                <ChevronRight size={18} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" style={{ color: '#4CAF50' }} />
              </Link>
            )
          })}

          {positions.length === 0 && (
            <div className="text-center py-16 glass-card rounded-2xl">
              <p style={{ color: 'rgba(255,255,255,0.3)' }} className="text-sm">
                No categories available yet.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-10" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {settings?.school_name} &bull; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
