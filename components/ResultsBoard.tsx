'use client'

import type { Position } from '@/lib/types'
import { Trophy, User } from 'lucide-react'

interface ResultsBoardProps {
  positions: Position[]
}

export default function ResultsBoard({ positions }: ResultsBoardProps) {
  return (
    <div className="space-y-8">
      {positions.length === 0 && (
        <div className="text-center py-12 glass-card rounded-2xl">
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            No positions or candidates found.
          </p>
        </div>
      )}

      {positions.map(position => {
        const candidates = [...(position.candidates ?? [])].sort((a, b) => b.vote_count - a.vote_count)
        const totalVotes = candidates.reduce((s, c) => s + c.vote_count, 0)
        const winner = candidates[0]

        return (
          <div key={position.id} className="glass-card rounded-2xl overflow-hidden">
            <div className="px-5 sm:px-6 py-5 border-b flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: 'rgba(212,168,67,0.1)' }}>
              <div>
                <h3 className="font-display text-xl font-semibold" style={{ color: '#FFFFFF' }}>
                  {position.title}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
                </p>
              </div>
              {winner && totalVotes > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl w-fit"
                  style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)' }}>
                  <Trophy size={14} style={{ color: '#4CAF50' }} />
                  <span className="text-sm font-semibold" style={{ color: '#4CAF50' }}>
                    {winner.full_name}
                  </span>
                </div>
              )}
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {candidates.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  No candidates
                </p>
              )}

              {candidates.map((candidate, idx) => {
                const pct = totalVotes > 0 ? (candidate.vote_count / totalVotes) * 100 : 0
                const isWinner = idx === 0 && totalVotes > 0

                return (
                  <div key={candidate.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0"
                      style={{ background: 'linear-gradient(135deg, #1A1A2E, #0A1A0A)' }}>
                      {candidate.photo_url ? (
                        <img
                          src={candidate.photo_url}
                          alt={candidate.full_name}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User size={20} style={{ color: 'rgba(212,168,67,0.3)' }} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                            {candidate.full_name}
                          </p>
                          {isWinner && <Trophy size={12} style={{ color: '#4CAF50' }} />}
                          {candidate.class && (
                            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                              {candidate.class}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-bold" style={{ color: isWinner ? '#4CAF50' : '#FFFFFF' }}>
                            {pct.toFixed(1)}%
                          </span>
                          <span className="text-xs w-14 text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {candidate.vote_count} vote{candidate.vote_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden"
                        style={{ background: 'rgba(212,168,67,0.08)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: isWinner
                              ? 'linear-gradient(90deg, #2E7D32, #66BB6A)'
                              : 'linear-gradient(90deg, #1A1A2E, #3A3A50)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
