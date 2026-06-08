import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import EchangesPageClient from './EchangesPageClient'

export const metadata = {
  title: 'Échanges — Panini Club',
}

export type UserLeagueSimple = {
  id: string
  name: string
}

export default async function EchangesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value
  if (!token) redirect('/login')

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) redirect('/login')

  const { data: memberships } = await supabaseAdmin
    .from('league_members')
    .select('league_id, leagues(id, name)')
    .eq('user_id', user.id)

  const leagues: UserLeagueSimple[] = (memberships ?? [])
    .map((m) => {
      const raw = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues
      const l = raw as { id: string; name: string } | null
      return l ? { id: l.id, name: l.name } : null
    })
    .filter(Boolean) as UserLeagueSimple[]

  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-10" style={{ backgroundColor: '#0a1628' }}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-black text-white">
            Mes <span style={{ color: '#ffd60a' }}>échanges</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Coordonne tes échanges de stickers en double avec les membres de ta ligue.
          </p>
        </div>

        <Suspense fallback={null}>
          <EchangesPageClient
            leagues={leagues}
            currentUserId={user.id}
          />
        </Suspense>
      </div>
    </main>
  )
}
