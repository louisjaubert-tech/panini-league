import { Suspense } from 'react'
import LeaderboardClient from './LeaderboardClient'
import { fetchLeaderboard } from '@/app/actions/leaderboard'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const metadata = {
  title: 'Classement — Panini Club',
  description: 'Classement des collectionneurs Panini Club',
}

export type UserLeague = {
  id: string
  name: string
}

export default async function LeaderboardPage() {
  const rows = await fetchLeaderboard()

  // Optionally fetch user leagues if logged in
  let userLeagues: UserLeague[] = []
  let currentUserId: string | null = null

  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value

  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) {
      currentUserId = user.id
      const { data: memberships } = await supabaseAdmin
        .from('league_members')
        .select('league_id, leagues(id, name)')
        .eq('user_id', user.id)

      userLeagues = (memberships ?? [])
        .map((m) => {
          const raw = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues
          const l = raw as { id: string; name: string } | null
          return l ? { id: l.id, name: l.name } : null
        })
        .filter(Boolean) as UserLeague[]
    }
  }

  return (
    <main className="min-h-screen bg-[#0a1628] px-4 sm:px-6 lg:px-8 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Classement</h1>
          <p className="mt-1 text-sm text-gray-400">
            {rows.length} collectionneurs triés par nombre de cartes uniques.
          </p>
        </div>
        <Suspense fallback={null}>
          <LeaderboardClient
            initial={rows}
            userLeagues={userLeagues}
            currentUserId={currentUserId}
          />
        </Suspense>
      </div>
    </main>
  )
}
