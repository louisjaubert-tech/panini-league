import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import LeaguesClient, { CopyCodeButton, CopyLinkButton } from './LeaguesClient'

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
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  {/* Infos ligue */}
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-white">{league.name}</p>
                    <p className="mt-0.5 text-xs" style={{ color: '#64748b' }}>
                      {league.member_count} membre{league.member_count !== 1 ? 's' : ''}
                      {league.created_by === user.id && (
                        <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: 'rgba(249,115,22,0.2)', color: '#fb923c' }}>
                          admin
                        </span>
                      )}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <CopyCodeButton code={league.invite_code} />
                      <CopyLinkButton code={league.invite_code} />
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <Link
                      href={`/leaderboard?league=${league.id}`}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-80"
                      style={{ backgroundColor: '#f97316' }}
                    >
                      🏆 Classement
                    </Link>
                    <Link
                      href={`/leagues/${league.id}/echanges`}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      🔄 Échanges
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </main>
  )
}
