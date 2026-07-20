import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function extractAccessToken(cookies: { name: string; value: string }[]): string | null {
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/(.+)\.supabase\.co/)?.[1]
  const prefix = projectRef ? `sb-${projectRef}-auth-token` : '-auth-token'
  const authCookie = cookies.find(c => c.name === prefix || c.name.includes(prefix))
  if (!authCookie) return null
  const raw = authCookie.value
  try {
    const base64 = raw.startsWith('base64-') ? raw.slice(7) : raw
    const json = JSON.parse(Buffer.from(base64, 'base64url').toString('utf-8'))
    const session = json?.session ?? json
    if (session?.access_token) return session.access_token
  } catch {}
  try {
    const json = JSON.parse(raw)
    const session = json?.session ?? json
    if (session?.access_token) return session.access_token
  } catch {}
  if (raw.split('.').length === 3) return raw
  return null
}

async function getCallerAdmin(req: NextRequest) {
  try {
    const accessToken = extractAccessToken(req.cookies.getAll())
    if (!accessToken) return null

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: { user } } = await supabase.auth.getUser(accessToken)
    const email = user?.email
    if (!email) return null

    if (email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return { id: '', role: 'super_admin' }
    }

    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('admin_profiles')
      .select('id, role')
      .eq('email', email)
      .maybeSingle()
    return profile
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const admin = await getCallerAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Not authenticated as admin' }, { status: 401 })
  }

  const supabase = createAdminClient()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { action } = body

  try {
    if (action === 'add_position') {
      const { title, slug, description, display_order } = body as {
        title: string; slug: string; description?: string; display_order?: number
      }
      const { data, error } = await supabase.from('positions').insert({
        title, slug, description: description ?? null, display_order: display_order ?? 0,
      }).select().single()
      if (error) return NextResponse.json({ error: String(error?.message || error) }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (action === 'update_position') {
      const { id, title, slug, description } = body as { id: string; title?: string; slug?: string; description?: string }
      const updates: Record<string, unknown> = {}
      if (title !== undefined) updates.title = title
      if (slug !== undefined) updates.slug = slug
      if (description !== undefined) updates.description = description ?? null
      const { data, error } = await supabase.from('positions').update(updates).eq('id', id).select().single()
      if (error) return NextResponse.json({ error: String(error?.message || error) }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (action === 'delete_position') {
      const { id } = body as { id: string }
      const { error } = await supabase.from('positions').delete().eq('id', id)
      if (error) return NextResponse.json({ error: String(error?.message || error) }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (action === 'add_candidate') {
      const { position_id, full_name, bio, photo_url } = body as {
        position_id: string; full_name: string; bio?: string; photo_url?: string
      }
      const { data, error } = await supabase.from('candidates').insert({
        position_id, full_name, bio: bio ?? null, photo_url: photo_url ?? null,
      }).select().single()
      if (error) return NextResponse.json({ error: String(error?.message || error) }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (action === 'update_candidate') {
      const { id, full_name, bio, photo_url } = body as {
        id: string; full_name?: string; bio?: string; photo_url?: string
      }
      const updates: Record<string, unknown> = {}
      if (full_name !== undefined) updates.full_name = full_name
      if (bio !== undefined) updates.bio = bio ?? null
      if (photo_url !== undefined) updates.photo_url = photo_url ?? null
      const { data, error } = await supabase.from('candidates').update(updates).eq('id', id).select().single()
      if (error) return NextResponse.json({ error: String(error?.message || error) }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (action === 'delete_candidate') {
      const { id } = body as { id: string }
      const { error } = await supabase.from('candidates').delete().eq('id', id)
      if (error) return NextResponse.json({ error: String(error?.message || error) }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (action === 'bulk_import') {
      type BulkRow = { position: string; full_name: string; bio?: string }
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

      const { data: existingPositions } = await supabase
        .from('positions').select('id, title').in('title', positionTitles)

      const existingMap: Record<string, string> = {}
      for (const p of existingPositions ?? []) existingMap[p.title] = p.id

      const toUpsertPositions = positionTitles
        .filter(t => !existingMap[t])
        .map(title => ({ title, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), description: null as string | null, display_order: 0 }))

      const { data: newPositions } = toUpsertPositions.length
        ? await supabase.from('positions').insert(toUpsertPositions).select()
        : { data: [] as any[] }

      for (const p of newPositions ?? []) existingMap[p.title] = p.id

      const toUpsertCandidates: { position_id: string; full_name: string; bio: string | null }[] = []
      for (const [title, candidateRows] of Object.entries(grouped)) {
        const posId = existingMap[title]
        if (!posId) continue
        for (const row of candidateRows) {
          toUpsertCandidates.push({
            position_id: posId,
            full_name: row.full_name.trim(),
            bio: row.bio?.trim() || null,
          })
        }
      }

      if (toUpsertCandidates.length) {
        const candidatesJson = toUpsertCandidates.map(c => ({
          position_id: c.position_id,
          full_name: c.full_name,
          bio: c.bio ?? '',
        }))
        const { error: candUpsertError } = await supabase.rpc('bulk_upsert_candidates', {
          p_candidates: candidatesJson,
        })
        if (candUpsertError) {
          return NextResponse.json({ error: candUpsertError.message }, { status: 500 })
        }
      }

      const { data: finalPositions } = await supabase
        .from('positions').select('*, candidates(*)')
        .in('title', positionTitles)
        .order('display_order')

      return NextResponse.json({ data: finalPositions })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
