import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'

async function getCallerAdmin(req: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            const cookie = req.headers.get('cookie') ?? ''
            if (!cookie) return []
            return cookie.split(';').map(pair => {
              const [name, ...rest] = pair.trim().split('=')
              return { name, value: rest.join('=') }
            })
          },
          setAll() {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return null

    const adminClient = createAdminClient()
    const { data: profile, error: profileError } = await adminClient
      .from('admin_profiles')
      .select('id, role')
      .eq('email', user.email)
      .maybeSingle()

    if (profileError) {
      console.error('[admin/positions] Profile lookup error:', profileError.message)
    }
    return profile
  } catch (err) {
    console.error('[admin/positions] getCallerAdmin error:', err instanceof Error ? err.message : 'unknown')
    return null
  }
}

export async function POST(req: NextRequest) {
  console.log('[admin/positions] Request received')
  console.log('[admin/positions] env check:', {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  })

  let admin
  try {
    admin = await getCallerAdmin(req)
  } catch (err) {
    console.error('[admin/positions] getCallerAdmin threw:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Auth check failed' }, { status: 500 })
  }

  console.log('[admin/positions] admin:', admin)

  if (!admin) {
    console.log('[admin/positions] Not authenticated as admin')
    return NextResponse.json({ error: 'Not authenticated as admin' }, { status: 401 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[admin/positions] SUPABASE_SERVICE_ROLE_KEY not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const supabase = createAdminClient()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { action } = body
  console.log('[admin/positions] action:', action)

  try {
    if (action === 'add_position') {
      const { title, description, display_order } = body as { title: string; description?: string; display_order?: number }
      const { data, error } = await supabase.from('positions').insert({
        title, description: description ?? null, display_order: display_order ?? 0,
      }).select().single()
      if (error) {
        console.error('[admin/positions] add_position error:', JSON.stringify(error))
        return NextResponse.json({ error: String(error?.message || error) }, { status: 500 })
      }
      return NextResponse.json({ data })
    }

    if (action === 'update_position') {
      const { id, title, description } = body as { id: string; title: string; description?: string }
      const { data, error } = await supabase.from('positions').update({
        title, description: description ?? null,
      }).eq('id', id).select().single()
      if (error) {
        console.error('[admin/positions] update_position error:', JSON.stringify(error))
        return NextResponse.json({ error: String(error?.message || error) }, { status: 500 })
      }
      return NextResponse.json({ data })
    }

    if (action === 'delete_position') {
      const { id } = body as { id: string }
      const { error } = await supabase.from('positions').delete().eq('id', id)
      if (error) {
        console.error('[admin/positions] delete_position error:', JSON.stringify(error))
        return NextResponse.json({ error: String(error?.message || error) }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'add_candidate') {
      const { position_id, full_name, class: cls, manifesto, photo_url } = body as {
        position_id: string; full_name: string; class?: string; manifesto?: string; photo_url?: string
      }
      const { data, error } = await supabase.from('candidates').insert({
        position_id, full_name, class: cls ?? null, manifesto: manifesto ?? null,
        photo_url: photo_url ?? null,
      }).select().single()
      if (error) {
        console.error('[admin/positions] add_candidate error:', JSON.stringify(error))
        return NextResponse.json({ error: String(error?.message || error) }, { status: 500 })
      }
      return NextResponse.json({ data })
    }

    if (action === 'update_candidate') {
      const { id, full_name, class: cls, manifesto, photo_url } = body as {
        id: string; full_name: string; class?: string; manifesto?: string; photo_url?: string
      }
      const { data, error } = await supabase.from('candidates').update({
        full_name, class: cls ?? null, manifesto: manifesto ?? null, photo_url: photo_url ?? null,
      }).eq('id', id).select().single()
      if (error) {
        console.error('[admin/positions] update_candidate error:', JSON.stringify(error))
        return NextResponse.json({ error: String(error?.message || error) }, { status: 500 })
      }
      return NextResponse.json({ data })
    }

    if (action === 'delete_candidate') {
      const { id } = body as { id: string }
      console.log('[admin/positions] delete_candidate with id:', id)
      const { error } = await supabase.from('candidates').delete().eq('id', id)
      if (error) {
        console.error('[admin/positions] delete_candidate error:', JSON.stringify(error))
        return NextResponse.json({ error: String(error?.message || error) }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'bulk_import') {
      type BulkRow = { position: string; full_name: string; class?: string; manifesto?: string }
      const { rows } = body as { rows: BulkRow[] }

      const grouped: Record<string, BulkRow[]> = {}
      for (const row of rows) {
        const title = row.position.trim()
        if (!title || !row.full_name?.trim()) continue
        if (!grouped[title]) grouped[title] = []
        grouped[title].push(row)
      }

      const positionTitles = Object.keys(grouped)
      if (!positionTitles.length) {
        return NextResponse.json({ error: 'No valid rows found' }, { status: 400 })
      }

      const { data: existingPositions, error: posSelectError } = await supabase
        .from('positions').select('id, title').in('title', positionTitles)
      if (posSelectError) {
        console.error('[admin/positions] bulk_import pos select error:', JSON.stringify(posSelectError))
        return NextResponse.json({ error: posSelectError.message }, { status: 500 })
      }

      const existingMap: Record<string, string> = {}
      for (const p of existingPositions ?? []) existingMap[p.title] = p.id

      const toUpsertPositions = positionTitles
        .filter(t => !existingMap[t])
        .map(title => ({ title, description: null, display_order: 0 }))

      const { data: newPositions, error: posInsertError } = toUpsertPositions.length
        ? await supabase.from('positions').insert(toUpsertPositions).select()
        : { data: [], error: null }
      if (posInsertError) {
        console.error('[admin/positions] bulk_import pos insert error:', JSON.stringify(posInsertError))
        return NextResponse.json({ error: posInsertError.message }, { status: 500 })
      }

      for (const p of newPositions ?? []) existingMap[p.title] = p.id

      const posIds = Object.values(existingMap)
      const { data: existingCandidates } = posIds.length
        ? await supabase.from('candidates').select('id, position_id, full_name').in('position_id', posIds)
        : { data: [] }

      const existingCandidateMap: Record<string, string> = {}
      for (const c of existingCandidates ?? []) {
        existingCandidateMap[`${c.position_id}::${c.full_name}`] = c.id
      }

      const toUpsertCandidates: { id: string; position_id: string; full_name: string; class: string | null; manifesto: string | null }[] = []
      for (const [title, candidateRows] of Object.entries(grouped)) {
        const posId = existingMap[title]
        if (!posId) continue
        for (const row of candidateRows) {
          toUpsertCandidates.push({
            id: existingCandidateMap[`${posId}::${row.full_name.trim()}`] ?? '',
            position_id: posId,
            full_name: row.full_name.trim(),
            class: row.class?.trim() || null,
            manifesto: row.manifesto?.trim() || null,
          })
        }
      }

      if (toUpsertCandidates.length) {
        const { error: candUpsertError } = await supabase
          .from('candidates')
          .upsert(toUpsertCandidates, { onConflict: 'position_id,full_name' })
        if (candUpsertError) {
          console.error('[admin/positions] bulk_import candidates upsert error:', JSON.stringify(candUpsertError))
          return NextResponse.json({ error: candUpsertError.message }, { status: 500 })
        }
      }

      const { data: finalPositions } = await supabase
        .from('positions').select('*, candidates(*)')
        .in('title', positionTitles)
        .order('display_order')

      return NextResponse.json({ data: finalPositions, count: { positions: positionTitles.length, candidates: toUpsertCandidates.length } })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[admin/positions] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}