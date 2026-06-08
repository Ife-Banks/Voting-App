'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Position, Candidate } from '@/lib/types'
import {
  Plus, Trash2, ChevronDown, ChevronUp, Edit2,
  Upload, X, Save, Loader2, User, GripVertical
} from 'lucide-react'

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [newPositionTitle, setNewPositionTitle] = useState('')
  const [newPositionDesc, setNewPositionDesc] = useState('')
  const [addingPosition, setAddingPosition] = useState(false)
  const [showNewPosition, setShowNewPosition] = useState(false)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('positions').select('*, candidates(*)').order('display_order')
    if (data) setPositions(data)
    setLoading(false)
  }

  async function addPosition() {
    if (!newPositionTitle.trim()) return
    setAddingPosition(true)
    const { data } = await supabase.from('positions').insert({
      title: newPositionTitle, description: newPositionDesc,
      display_order: positions.length
    }).select().single()
    if (data) {
      setPositions(prev => [...prev, { ...data, candidates: [] }])
      setNewPositionTitle(''); setNewPositionDesc(''); setShowNewPosition(false)
    }
    setAddingPosition(false)
  }

  async function deletePosition(id: string) {
    if (!confirm('Delete this position and all its candidates?')) return
    await supabase.from('positions').delete().eq('id', id)
    setPositions(prev => prev.filter(p => p.id !== id))
  }

  function updatePositionLocal(id: string, updates: Partial<Position>) {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  function updateCandidatesLocal(positionId: string, candidates: Candidate[]) {
    setPositions(prev => prev.map(p => p.id === positionId ? { ...p, candidates } : p))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin" style={{ color: '#C9A84C' }} />
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text mb-1">Positions & Candidates</h1>
          <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>
            Manage election positions and add candidates
          </p>
        </div>
        <button onClick={() => setShowNewPosition(true)}
          className="btn-gold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
          <Plus size={16} /> Add Position
        </button>
      </div>

      {/* New position form */}
      {showNewPosition && (
        <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-up">
          <h3 className="font-display text-lg font-semibold mb-4" style={{ color: '#F5F0E8' }}>
            New Position
          </h3>
          <div className="space-y-4">
            <input value={newPositionTitle} onChange={e => setNewPositionTitle(e.target.value)}
              className="input-field w-full px-4 py-3 rounded-xl text-sm"
              placeholder="Position title (e.g. President, Vice President)" />
            <textarea value={newPositionDesc} onChange={e => setNewPositionDesc(e.target.value)}
              className="input-field w-full px-4 py-3 rounded-xl text-sm resize-none"
              rows={2} placeholder="Brief description (optional)" />
            <div className="flex gap-3">
              <button onClick={addPosition} disabled={addingPosition}
                className="btn-gold px-6 py-2.5 rounded-xl text-sm flex items-center gap-2">
                {addingPosition ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Create Position
              </button>
              <button onClick={() => setShowNewPosition(false)}
                className="btn-ghost px-6 py-2.5 rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Positions list */}
      <div className="space-y-4">
        {positions.length === 0 && (
          <div className="text-center py-16 glass-card rounded-2xl">
            <p style={{ color: 'rgba(245,240,232,0.3)' }} className="text-sm">
              No positions yet. Add your first position above.
            </p>
          </div>
        )}
        {positions.map((position, idx) => (
          <PositionCard key={position.id} position={position} idx={idx}
            expanded={expanded === position.id}
            onToggle={() => setExpanded(prev => prev === position.id ? null : position.id)}
            onDelete={() => deletePosition(position.id)}
            onUpdatePosition={(updates) => updatePositionLocal(position.id, updates)}
            onUpdateCandidates={(candidates) => updateCandidatesLocal(position.id, candidates)}
          />
        ))}
      </div>
    </div>
  )
}

function PositionCard({
  position, idx, expanded, onToggle, onDelete, onUpdatePosition, onUpdateCandidates
}: {
  position: Position, idx: number, expanded: boolean,
  onToggle: () => void, onDelete: () => void,
  onUpdatePosition: (u: Partial<Position>) => void,
  onUpdateCandidates: (c: Candidate[]) => void,
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(position.title)
  const [desc, setDesc] = useState(position.description ?? '')
  const [showCandidateForm, setShowCandidateForm] = useState(false)
  const supabase = createClient()

  async function savePosition() {
    await supabase.from('positions').update({ title, description: desc }).eq('id', position.id)
    onUpdatePosition({ title, description: desc })
    setEditing(false)
  }

  async function deleteCandidate(candidateId: string) {
    if (!confirm('Remove this candidate?')) return
    await supabase.from('candidates').delete().eq('id', candidateId)
    onUpdateCandidates((position.candidates ?? []).filter(c => c.id !== candidateId))
  }

  function onCandidateAdded(candidate: Candidate) {
    onUpdateCandidates([...(position.candidates ?? []), candidate])
    setShowCandidateForm(false)
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 cursor-pointer" onClick={onToggle}>
        <GripVertical size={16} style={{ color: 'rgba(245,240,232,0.2)' }} />
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C' }}>{idx + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg font-semibold" style={{ color: '#F5F0E8' }}>{position.title}</p>
          {position.description && (
            <p className="text-xs truncate" style={{ color: 'rgba(245,240,232,0.4)' }}>{position.description}</p>
          )}
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>
          {position.candidates?.length ?? 0} candidate{(position.candidates?.length ?? 0) !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={() => setEditing(!editing)}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: '#C9A84C' }}>
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete}
            className="p-2 rounded-lg hover:bg-red-900/20 transition-colors" style={{ color: '#E74C3C' }}>
            <Trash2 size={14} />
          </button>
          <div style={{ color: 'rgba(245,240,232,0.4)' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="px-6 pb-4 border-t" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
          <div className="pt-4 space-y-3">
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="input-field w-full px-4 py-2.5 rounded-xl text-sm" />
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              className="input-field w-full px-4 py-2.5 rounded-xl text-sm resize-none" rows={2} />
            <div className="flex gap-2">
              <button onClick={savePosition} className="btn-gold px-5 py-2 rounded-xl text-xs">Save</button>
              <button onClick={() => setEditing(false)} className="btn-ghost px-5 py-2 rounded-xl text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Candidates panel */}
      {expanded && (
        <div className="border-t" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold" style={{ color: 'rgba(245,240,232,0.7)' }}>Candidates</h4>
              <button onClick={() => setShowCandidateForm(true)}
                className="btn-ghost px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5">
                <Plus size={12} /> Add Candidate
              </button>
            </div>

            {showCandidateForm && (
              <CandidateForm positionId={position.id}
                onSave={onCandidateAdded}
                onCancel={() => setShowCandidateForm(false)} />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(position.candidates ?? []).map(candidate => (
                <div key={candidate.id} className="glass-card rounded-xl overflow-hidden">
                  <div className="h-32 relative" style={{ background: 'linear-gradient(135deg, #1A4A3A22, #0A0A0F)' }}>
                    {candidate.photo_url ? (
                      <img src={candidate.photo_url} alt={candidate.full_name}
                        className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <User size={40} style={{ color: 'rgba(201,168,76,0.2)' }} />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-display font-semibold text-sm mb-0.5" style={{ color: '#F5F0E8' }}>
                      {candidate.full_name}
                    </p>
                    {candidate.class && (
                      <p className="text-xs" style={{ color: '#C9A84C' }}>{candidate.class}</p>
                    )}
                    <button onClick={() => deleteCandidate(candidate.id)}
                      className="mt-2 text-xs flex items-center gap-1 hover:text-red-400 transition-colors"
                      style={{ color: 'rgba(245,240,232,0.3)' }}>
                      <Trash2 size={11} /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {(position.candidates ?? []).length === 0 && !showCandidateForm && (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(245,240,232,0.25)' }}>
                No candidates yet. Add candidates for this position.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CandidateForm({ positionId, onSave, onCancel }: {
  positionId: string
  onSave: (c: Candidate) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [cls, setCls] = useState('')
  const [manifesto, setManifesto] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)

    let photo_url: string | null = null

    if (photo) {
      const ext = photo.name.split('.').pop()
      const path = `candidates/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('candidates').upload(path, photo, { upsert: true })
      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = supabase.storage.from('candidates').getPublicUrl(path)
        photo_url = publicUrl
      }
    }

    const { data } = await supabase.from('candidates').insert({
      position_id: positionId, full_name: name, class: cls, manifesto, photo_url
    }).select().single()

    if (data) onSave(data)
    setSaving(false)
  }

  return (
    <div className="emerald-card rounded-xl p-4 mb-4">
      <h5 className="text-sm font-semibold mb-3" style={{ color: '#F5F0E8' }}>New Candidate</h5>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <input value={name} onChange={e => setName(e.target.value)}
          className="input-field px-3 py-2.5 rounded-lg text-sm" placeholder="Full Name *" />
        <input value={cls} onChange={e => setCls(e.target.value)}
          className="input-field px-3 py-2.5 rounded-lg text-sm" placeholder="Class / Year (e.g. SS3A)" />
      </div>
      <textarea value={manifesto} onChange={e => setManifesto(e.target.value)}
        className="input-field w-full px-3 py-2.5 rounded-lg text-sm resize-none mb-3"
        rows={2} placeholder="Manifesto / Campaign statement (optional)" />

      {/* Photo upload */}
      <div className="flex items-center gap-3 mb-4">
        {preview ? (
          <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
            <button onClick={() => { setPhoto(null); setPreview(null) }}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(10,10,15,0.8)' }}>
              <X size={10} style={{ color: '#F5F0E8' }} />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()}
            className="w-16 h-16 rounded-xl border-2 border-dashed flex items-center justify-center shrink-0 transition-colors hover:border-yellow-600"
            style={{ borderColor: 'rgba(201,168,76,0.3)' }}>
            <Upload size={20} style={{ color: 'rgba(201,168,76,0.5)' }} />
          </button>
        )}
        <div>
          <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(245,240,232,0.7)' }}>
            Candidate Photo
          </p>
          <button onClick={() => fileRef.current?.click()}
            className="text-xs" style={{ color: '#C9A84C' }}>
            {preview ? 'Change photo' : 'Upload photo'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="btn-gold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Add Candidate
        </button>
        <button onClick={onCancel} className="btn-ghost px-5 py-2 rounded-xl text-xs">Cancel</button>
      </div>
    </div>
  )
}
