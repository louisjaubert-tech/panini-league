import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import LeaguesClient from './LeaguesClient'

type LeagueRow = {
  id: string
  name: string
  invite_code: string
  created_by: string
  member_count: number
}

export default async function LeaguesPage() {
  // ── Auth ─────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value
  if (!token) redirect('/login')

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) redirect('/login')

  // ── Récupérer les ligues de l'utilisateur ────────────────────
  // league_members → leagues + count des membres par ligue
  const { data: memberships } = await supabaseAdmin
    .from('league_members')
    .select('league_id, leagues(id, name, invite_code, created_by)')
    .eq('user_id', user.id)

  const leagueIds = (memberships ?? [])
    .map((m) => {
      const l = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues
      return (l as { id: string } | null)?.id
    })
    .filter(Boolean) as string[]

  // Compter les membres pour chaque ligue
  const memberCounts: Record<string, number> = {}
  if (leagueIds.length > 0) {
    const { data: counts } = await supabaseAdmin
      .from('league_members')
      .select('league_id')
      .in('league_id', leagueIds)

    for (const row of counts ?? []) {
      const lid = row.league_id as string
      memberCounts[lid] = (memberCounts[lid] ?? 0) + 1
    }
  }

  const leagues: LeagueRow[] = (memberships ?? [])
    .map((m) => {
      const raw = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues
      const l = raw as { id: string; name: string; invite_code: string; created_by: string } | null
      if (!l) return null
      return {
        id:           l.id,
        name:         l.name,
        invite_code:  l.invite_code,
        created_by:   l.created_by,
        member_count: memberCounts[l.id] ?? 1,
      }
    })
    .filter(Boolean) as LeagueRow[]

  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-10" style={{ backgroundColor: '#0a1628' }}>
      <div className="mx-auto max-w-3xl space-y-10">

        {/* ── En-tête ── */}
        <div>
          <h1 className="text-3xl font-black text-white">
            Mes <span style={{ color: '#ffd60a' }}>ligues</span>
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#64748b' }}>
            Défie tes amis dans des ligues privées.
          </p>
        </div>

        {/* ── Formulaires créer / rejoindre ── */}
        <LeaguesClient />

        {/* ── Liste des ligues ── */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-white">
            Mes ligues ({leagues.length})
          </h2>

          {leagues.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm" style={{ color: '#64748b' }}>
              Tu n&apos;es membre d&apos;aucune ligue pour l&apos;instant.
            </div>
          ) : (
            <ul className="space-y-3">
              {leagues.map((league) => (
                <li
                  key={league.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{league.name}</p>
                    <p className="mt-0.5 text-xs" style={{ color: '#64748b' }}>
                      {league.member_count} membre{league.member_count !== 1 ? 's' : ''}
                      {league.created_by === user.id && (
                        <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: 'rgba(220,38,38,0.2)', color: '#f87171' }}>
                          admin
                        </span>
                      )}
                    </p>
                  </div>
                  <Link
                    href={`/leagues/${league.id}`}
                    className="shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-80"
                    style={{ backgroundColor: '#dc2626' }}
                  >
                    Voir →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </main>
  )
}
