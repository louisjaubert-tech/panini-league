import { Suspense } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'
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
  let userId: string | null = null

  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) userId = user.id
  }

  // ── Vue invité ────────────────────────────────────────────────
  if (!userId) {
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

          <div className="flex flex-col items-center gap-6 rounded-2xl border border-dashed border-white/15 px-8 py-16 text-center">
            <p className="text-4xl">🔄</p>
            <p className="text-base font-semibold text-white">
              Les échanges se font au sein d&apos;une ligue entre amis.
            </p>
            <p className="text-sm text-gray-400 max-w-sm">
              Rejoins une ligue pour voir qui peut te donner ses doublons et proposer les tiens à d&apos;autres collectionneurs !
            </p>
            <Link
              href="/register"
              className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#f97316' }}
            >
              S&apos;inscrire pour rejoindre une ligue
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // ── Vue connectée ─────────────────────────────────────────────
  const { data: memberships } = await supabaseAdmin
    .from('league_members')
    .select('league_id, leagues(id, name)')
    .eq('user_id', userId)

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
            currentUserId={userId}
          />
        </Suspense>
      </div>
    </main>
  )
}
