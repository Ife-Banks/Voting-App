'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Position, Candidate } from '@/lib/types'
import Cropper from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import type { Area, Point } from 'react-easy-crop'
import {
  Plus, Trash2, ChevronDown, ChevronUp, Edit2,
  Upload, X, Save, Loader2, User, GripVertical, Crop
} from 'lucide-react'

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [newPositionTitle, setNewPositionTitle] = useState('')
  const [newPositionDesc, setNewPositionDesc] = useState('')
  const [addingPosition, setAddingPosition] = useState(false)
  const [showNewPosition, setShowNewPosition] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('positions').select('*, candidates(*)').order('display_order')
    if (data) setPositions(data)
    setLoading(false)
  }

  async function addPosition() {
    if (!newPositionTitle.trim()) return
    setAddingPosition(true)
    const res = await fetch('/api/admin/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_position',
        title: newPositionTitle,
        description: newPositionDesc,
        display_order: positions.length,
      }),
    })
    const { data } = await res.json()
    if (data) {
      setPositions(prev => [...prev, { ...data, candidates: [] }])
      setNewPositionTitle(''); setNewPositionDesc(''); setShowNewPosition(false)
    }
    setAddingPosition(false)
  }

  async function deletePosition(id: string) {
    if (!confirm('Delete this position and all its candidates?')) return
    await fetch('/api/admin/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_position', id }),
    })
    setPositions(prev => prev.filter(p => p.id !== id))
  }

  function parseBulkText(text: string) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) return []
    const startIndex = lines[0].toLowerCase().startsWith('position') ? 1 : 0
    return lines.slice(startIndex).map(line => {
      const parts = line.split(',').map(p => p.trim())
      return {
        position: parts[0] ?? '',
        full_name: parts[1] ?? '',
        class: parts[2] ?? '',
        manifesto: parts.slice(3).join(', '),
      }
    }).filter(r => r.position && r.full_name)
  }

  async function handleBulkImport() {
    const rows = parseBulkText(bulkText)
    if (!rows.length) {
      alert('No valid rows found. Use format: Position,Full Name,Class,Manifesto')
      return
    }
    setBulkLoading(true)
    const res = await fetch('/api/admin/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk_import', rows }),
    })
    const { data, error } = await res.json()
    if (error) {
      alert(`Error: ${error}`)
    } else if (data) {
      await load()
      setBulkText('')
      setShowBulk(false)
      const counts = data.reduce((acc: Record<string, number>, p: any) => {
        acc.positions = (acc.positions || 0) + 1
        acc.candidates = (acc.candidates || 0) + (p.candidates?.length || 0)
        return acc
      }, {})
      alert(`Imported ${data.length} position(s) with candidates`)
    }
    setBulkLoading(false)
  }

  function updatePositionLocal(id: string, updates: Partial<Position>) {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  function updateCandidatesLocal(positionId: string, candidates: Candidate[]) {
    setPositions(prev => prev.map(p => p.id === positionId ? { ...p, candidates } : p))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin" style={{ color: '#4CAF50' }} />
    </div>
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold gold-text mb-1">Positions & Candidates</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Manage election positions and add candidates
          </p>
        </div>
        <button onClick={() => setShowBulk(true)}
          className="btn-ghost px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
          <Upload size={16} /> Bulk Import
        </button>
        <button onClick={() => setShowNewPosition(true)}
          className="btn-gold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
          <Plus size={16} /> Add Position
        </button>
      </div>

      {/* New position form */}
      {showNewPosition && (
        <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-up">
          <h3 className="font-display text-lg font-semibold mb-4" style={{ color: '#FFFFFF' }}>
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

      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card rounded-2xl p-5 sm:p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl font-semibold" style={{ color: '#FFFFFF' }}>Bulk Import</h3>
              <button onClick={() => setShowBulk(false)}>
                <X size={18} style={{ color: 'rgba(255,255,255,0.4)' }} />
              </button>
            </div>
            <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Paste CSV with format: <strong>Position,Full Name,Class,Manifesto</strong>. The header row is optional.
            </p>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              className="input-field w-full px-4 py-3 rounded-xl text-sm resize-none mb-4"
              rows={12}
              placeholder={"President,John Doe,SS3A,My campaign promises\nVice President,Jane Smith,SS2B,Her vision"}
            />
            {bulkText.trim() && (
              <p className="text-xs mb-3" style={{ color: 'rgba(76,175,80,0.7)' }}>
                {parseBulkText(bulkText).length} candidate row(s) detected
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleBulkImport} disabled={bulkLoading || !bulkText.trim()}
                className="btn-gold flex-1 py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                {bulkLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Import
              </button>
              <button onClick={() => setShowBulk(false)} className="btn-ghost px-5 py-3 rounded-xl text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Positions list */}
      <div className="space-y-4">
        {positions.length === 0 && (
          <div className="text-center py-16 glass-card rounded-2xl">
            <p style={{ color: 'rgba(255,255,255,0.3)' }} className="text-sm">
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
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null)

  async function savePosition() {
    await fetch('/api/admin/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_position', id: position.id, title, description: desc }),
    })
    onUpdatePosition({ title, description: desc })
    setEditing(false)
  }

  async function deleteCandidate(candidateId: string) {
    if (!confirm('Remove this candidate?')) return
    await fetch('/api/admin/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_candidate', id: candidateId }),
    })
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
        <GripVertical size={16} style={{ color: 'rgba(255,255,255,0.2)' }} />
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: 'rgba(76,175,80,0.15)', color: '#4CAF50' }}>{idx + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg font-semibold" style={{ color: '#FFFFFF' }}>{position.title}</p>
          {position.description && (
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{position.description}</p>
          )}
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(76,175,80,0.1)', color: '#4CAF50' }}>
          {position.candidates?.length ?? 0} candidate{(position.candidates?.length ?? 0) !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={() => setEditing(!editing)}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: '#4CAF50' }}>
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete}
            className="p-2 rounded-lg hover:bg-red-900/20 transition-colors" style={{ color: '#E74C3C' }}>
            <Trash2 size={14} />
          </button>
          <div style={{ color: 'rgba(255,255,255,0.4)' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="px-6 pb-4 border-t" style={{ borderColor: 'rgba(212,168,67,0.1)' }}>
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
        <div className="border-t" style={{ borderColor: 'rgba(212,168,67,0.1)' }}>
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>Candidates</h4>
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
                editingCandidateId === candidate.id ? (
                  <CandidateForm key={candidate.id}
                    positionId={position.id}
                    candidate={candidate}
                    onSave={(updated) => {
                      setEditingCandidateId(null)
                      onUpdateCandidates((position.candidates ?? []).map(c => c.id === updated.id ? updated : c))
                    }}
                    onCancel={() => setEditingCandidateId(null)} />
                ) : (
                  <div key={candidate.id} className="glass-card rounded-xl overflow-hidden">
                    <div className="h-40 relative" style={{ background: 'linear-gradient(135deg, #1A1A2E22, #0A1A0A)' }}>
                      {candidate.photo_url ? (
                        <img src={candidate.photo_url} alt={candidate.full_name}
                          className="w-full h-full object-cover object-top" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <User size={40} style={{ color: 'rgba(212,168,67,0.2)' }} />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-display font-semibold text-sm" style={{ color: '#FFFFFF' }}>
                          {candidate.full_name}
                        </p>
                        <button onClick={() => setEditingCandidateId(candidate.id)}
                          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                          style={{ color: '#4CAF50' }}>
                          <Edit2 size={12} />
                        </button>
                      </div>
                      {candidate.class && (
                        <p className="text-xs" style={{ color: '#4CAF50' }}>{candidate.class}</p>
                      )}
                      <button onClick={() => deleteCandidate(candidate.id)}
                        className="mt-2 text-xs flex items-center gap-1 hover:text-red-400 transition-colors"
                        style={{ color: 'rgba(255,255,255,0.3)' }}>
                        <Trash2 size={11} /> Remove
                      </button>
                    </div>
                  </div>
                )
              ))}
            </div>

            {(position.candidates ?? []).length === 0 && !showCandidateForm && (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
                No candidates yet. Add candidates for this position.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.src = url
  })
}

async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas empty')), 'image/jpeg', 0.9)
  })
}

function CandidateForm({ positionId, candidate, onSave, onCancel }: {
  positionId: string
  candidate?: Candidate
  onSave: (c: Candidate) => void
  onCancel: () => void
}) {
  const isEditing = !!candidate
  const [name, setName] = useState(candidate?.full_name ?? '')
  const [cls, setCls] = useState(candidate?.class ?? '')
  const [manifesto, setManifesto] = useState(candidate?.manifesto ?? '')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(candidate?.photo_url ?? null)
  const [saving, setSaving] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be under 5MB')
      return
    }
    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed')
      return
    }
    const url = URL.createObjectURL(file)
    setCropSrc(url)
  }

  function onCropComplete(_: Area, croppedPixels: Area) {
    setCroppedAreaPixels(croppedPixels)
  }

  async function confirmCrop() {
    if (!cropSrc || !croppedAreaPixels) return
    const blob = await getCroppedBlob(cropSrc, croppedAreaPixels)
    const file = new File([blob], 'candidate.jpg', { type: 'image/jpeg' })
    setPhoto(file)
    setPreview(URL.createObjectURL(blob))
    setCropSrc(null)
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()

    let photo_url: string | null = candidate?.photo_url ?? null

    if (photo) {
      const ext = 'jpg'
      const path = `${Date.now()}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('candidates').upload(path, photo, { upsert: true })
      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = supabase.storage.from('candidates').getPublicUrl(path)
        photo_url = publicUrl
      }
    }

    if (isEditing) {
      const res = await fetch('/api/admin/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_candidate', id: candidate!.id, full_name: name, class: cls, manifesto, photo_url }),
      })
      const { data } = await res.json()
      if (data) onSave(data)
    } else {
      const res = await fetch('/api/admin/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_candidate', position_id: positionId, full_name: name, class: cls, manifesto, photo_url }),
      })
      const { data } = await res.json()
      if (data) onSave(data)
    }
    setSaving(false)
  }

  return (
    <>
      {/* Crop dialog */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-lg mx-4 glass-card rounded-2xl overflow-hidden">
            <div className="p-4 border-b" style={{ borderColor: 'rgba(212,168,67,0.15)' }}>
              <h4 className="font-display font-semibold" style={{ color: '#FFFFFF' }}>Crop Photo</h4>
            </div>
            <div className="relative" style={{ height: 350 }}>
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={3 / 4}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="p-4 flex items-center justify-between">
              <input type="range" min={1} max={3} step={0.1} value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                className="w-32 accent-yellow-600" />
              <div className="flex gap-2">
                <button onClick={() => setCropSrc(null)}
                  className="btn-ghost px-5 py-2 rounded-xl text-xs">Cancel</button>
                <button onClick={confirmCrop}
                  className="btn-gold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5">
                  <Crop size={12} /> Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="emerald-card rounded-xl p-4 mb-4">
        <h5 className="text-sm font-semibold mb-3" style={{ color: '#FFFFFF' }}>{isEditing ? 'Edit Candidate' : 'New Candidate'}</h5>
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
                <X size={10} style={{ color: '#FFFFFF' }} />
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              className="w-16 h-16 rounded-xl border-2 border-dashed flex items-center justify-center shrink-0 transition-colors hover:border-yellow-600"
              style={{ borderColor: 'rgba(212,168,67,0.3)' }}>
              <Upload size={20} style={{ color: 'rgba(212,168,67,0.5)' }} />
            </button>
          )}
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Candidate Photo
            </p>
            <button onClick={() => fileRef.current?.click()}
              className="text-xs" style={{ color: '#4CAF50' }}>
              {preview ? 'Change photo' : 'Upload photo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={save} disabled={saving}
            className="btn-gold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {isEditing ? 'Save Changes' : 'Add Candidate'}
          </button>
          <button onClick={onCancel} className="btn-ghost px-5 py-2 rounded-xl text-xs">Cancel</button>
        </div>
      </div>
    </>
  )
}
