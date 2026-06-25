'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Student } from '@/lib/types'
import { Plus, Trash2, Upload, Search, CheckCircle2, Circle, Loader2, X, Download } from 'lucide-react'

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newMatricNumber, setNewMatricNumber] = useState('')
  const [adding, setAdding] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('students').select('*').order('email')
    if (data) setStudents(data)
    setLoading(false)
  }

  async function addStudent() {
    const email = newEmail.trim().toLowerCase()
    const matric_number = newMatricNumber.trim().toUpperCase()
    if (!email || !matric_number) return

    setAdding(true)
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_student', email, matric_number }),
    })
    const { data, error } = await res.json()
    if (error) {
      alert(`Error: ${error}`)
    } else if (data) {
      setStudents(prev => [...prev, data].sort((a, b) => (a.matric_number ?? a.email).localeCompare(b.matric_number ?? b.email)))
      setNewEmail('')
      setNewMatricNumber('')
    }
    setAdding(false)
  }

  async function deleteStudent(id: string, hasVoted: boolean) {
    if (hasVoted && !confirm('This student has already voted. Remove them anyway?')) return
    if (!hasVoted && !confirm('Remove this student?')) return
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_student', id }),
    })
    if (res.ok) {
      setStudents(prev => prev.filter(s => s.id !== id))
    }
  }

  async function resetVote(id: string, email: string) {
    if (!confirm(`Reset vote for ${email}? They will be able to vote again.`)) return
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_vote', id, student_email: email }),
    })
    if (res.ok) {
      setStudents(prev => prev.map(s => (s.id === id ? { ...s, has_voted: false } : s)))
    }
  }

  async function addBulk() {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    const rows: { email: string; matric_number: string }[] = []

    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim())
      if (parts.length >= 2) {
        rows.push({ email: parts[0].toLowerCase(), matric_number: parts[1].toUpperCase() })
      } else if (parts[0].includes('@')) {
        rows.push({ email: parts[0].toLowerCase(), matric_number: '' })
      }
    }

    if (!rows.length) {
      alert('No valid entries found. Use format: email,matric_number')
      return
    }

    setBulkLoading(true)
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk_import', rows }),
    })
    const { error } = await res.json()
    if (error) {
      alert(`Error: ${error}`)
    } else {
      await load()
      setBulkText('')
      setShowBulk(false)
      alert(`Added/updated ${rows.length} student(s)`)
    }
    setBulkLoading(false)
  }

  function exportCSV() {
    const csv = ['Email,Matric Number,Has Voted', ...students.map(s => `${s.email},${s.matric_number ?? ''},${s.has_voted}`)].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'students.csv'
    a.click()
  }

  const filtered = students.filter(s =>
    (s.email?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
    (s.matric_number?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )
  const votedCount = students.filter(s => s.has_voted).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-display font-bold gold-text mb-1">Students</h1>
          <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>
            {students.length} registered · {votedCount} voted · {students.length - votedCount} pending
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:shrink-0">
          <button onClick={exportCSV} className="btn-ghost px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
            <Download size={14} /> Export
          </button>
          <button onClick={() => setShowBulk(true)}
            className="btn-ghost px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
            <Upload size={14} /> Bulk Import
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'rgba(245,240,232,0.7)' }}>Add Student</h3>
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.7fr_auto] gap-3">
          <input
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStudent()}
            className="input-field w-full px-4 py-2.5 rounded-xl text-sm"
            placeholder="student@school.edu.ng"
            type="email"
          />
          <input
            value={newMatricNumber}
            onChange={e => setNewMatricNumber(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && addStudent()}
            className="input-field w-full px-4 py-2.5 rounded-xl text-sm"
            placeholder="MAT/2020/001"
          />
          <button
            onClick={addStudent}
            disabled={adding || !newEmail || !newMatricNumber}
            className="btn-gold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shrink-0"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add
          </button>
        </div>
      </div>

      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card rounded-2xl p-5 sm:p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl font-semibold" style={{ color: '#F5F0E8' }}>Bulk Import</h3>
              <button onClick={() => setShowBulk(false)}>
                <X size={18} style={{ color: 'rgba(245,240,232,0.4)' }} />
              </button>
            </div>
            <p className="text-xs mb-3" style={{ color: 'rgba(245,240,232,0.45)' }}>
              Paste one student per line in the format: <strong>email,matric_number</strong>
            </p>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              className="input-field w-full px-4 py-3 rounded-xl text-sm resize-none mb-4"
              rows={10}
              placeholder="student1@school.edu.ng,ENG/2020/001&#10;student2@school.edu.ng,MAT/2020/002"
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={addBulk} disabled={bulkLoading}
                className="btn-gold flex-1 py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                {bulkLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Import Emails
              </button>
              <button onClick={() => setShowBulk(false)} className="btn-ghost px-5 py-3 rounded-xl text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'rgba(245,240,232,0.3)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field w-full pl-11 pr-4 py-2.5 rounded-xl text-sm"
          placeholder="Search students..."
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin" style={{ color: '#C9A84C' }} />
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
                  <th className="text-left px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(245,240,232,0.4)' }}>Matric Number</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(245,240,232,0.4)' }}>Email</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(245,240,232,0.4)' }}>Status</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(245,240,232,0.4)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-sm" style={{ color: 'rgba(245,240,232,0.25)' }}>
                      {search ? 'No students match your search' : 'No students added yet'}
                    </td>
                  </tr>
                )}

                {filtered.map((student, i) => (
                  <tr
                    key={student.id}
                    className={`border-b transition-colors hover:bg-white/[0.02] ${i === filtered.length - 1 ? 'border-transparent' : ''}`}
                    style={{ borderColor: 'rgba(201,168,76,0.06)' }}
                  >
                    <td className="px-6 py-3.5">
                      <p className="text-sm font-mono" style={{ color: '#C9A84C' }}>{student.matric_number ?? '—'}</p>
                    </td>
                    <td className="px-6 py-3.5">
                      <p className="text-sm" style={{ color: '#F5F0E8' }}>{student.email}</p>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${student.has_voted ? 'badge-open' : 'badge-closed'}`}>
                        {student.has_voted
                          ? <><CheckCircle2 size={11} /> Voted</>
                          : <><Circle size={11} /> Pending</>}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {student.has_voted && (
                          <button
                            onClick={() => resetVote(student.id, student.email)}
                            className="text-xs hover:underline transition-colors"
                            style={{ color: 'rgba(201,168,76,0.6)' }}
                          >
                            Reset vote
                          </button>
                        )}
                        <button
                          onClick={() => deleteStudent(student.id, student.has_voted)}
                          className="p-1.5 rounded-lg hover:bg-red-900/20 transition-colors"
                          style={{ color: '#E74C3C' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
