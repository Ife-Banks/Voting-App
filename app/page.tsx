import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSessionFromCookie } from '@/lib/session'

export default async function RootPage() {
  // Check custom student session first
  const cookieStore = await cookies()
  const studentSession = await getSessionFromCookie(cookieStore.toString())
  if (studentSession) {
    redirect('/vote')
  }

  // Fall back to Supabase Auth (admin)
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user

  if (!user) redirect('/login')

  const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
  if (isAdmin) redirect('/admin/dashboard')
  redirect('/vote')
}
