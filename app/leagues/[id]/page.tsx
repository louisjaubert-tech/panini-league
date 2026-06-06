import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CopyButton, LeaveButton } from './LeagueDetailClient'
import { TOTAL_STICKERS } from '@/lib/stats'

type Member = {
  user_id: string
  username: string
  pct: number
  badgeCount: number
  isCreator: boolean
}

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // ── Auth ─────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value
  if (!token) redirect('/login')

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) redirect('/login')

  // ── Récupérer la ligue ────────────────────────────────────────
  const { data: league, error: leagueErr } = await supabaseAdmin
    .from('leagues')
    .select('id, name, invite_code, created_by')
    .eq('id', id)
    .single()

  if (leagueErr || !league) redirect('/leagues')

  // ── Vérifier que l'utilisateur est membre ────────────────────
  const { data: membership } = await supabaseAdmin
    .from('league_members')
    .select('id')
    .eq('league_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/leagues')

  // ── Récupérer tous les membres ────────────────────────────────
  const { data: memberRows } = await supabaseAdmin
    .from('league_members')
    .select('user_id, joined_at')
    .eq('league_id', id)
    .order('joined_at', { ascending: true })

  const memberIds = (memberRows ?? []).map((m) => m.user_id as string)

  // Profils, collections et badges en parallèle
  const [profilesResult, collectionsResult, badgesResult] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, username')
      .in('id', memberIds),
    supabaseAdmin
      .from('user_collection')
      .select('user_id')
      .in('user_id', memberIds),
    supabaseAdmin
      .from('user_badges')
      .select('user_id')
      .in('user_id', memberIds),
  ])

  // Comptes par membre
  const collectionCount: Record<string, number> = {}
  for (const r of collectionsResult.data ?? []) {
    const uid = r.user_id as string
    collectionCount[uid] = (collectionCount[uid] ?? 0) + 1
  }

  const badgeCount: Record<string, number> = {}
  for (const r of badgesResult.data ?? []) {
    const uid = r.user_id as string
    badgeCount[uid] = (badgeCount[uid] ?? 0) + 1
  }

  const profileMap = new Map(
    (profilesResult.data ?? []).map((p) => [p.id as string, p.username as string])
  )

  const members: Member[] = memberIds.map((uid) => ({
    user_id:   uid,
    username:  profileMap.get(uid) ?? 'Joueur',
    pct:       Math.round(((collectionCount[uid] ?? 0) / TOTAL_STICKERS) * 100),
    badgeCount: badgeCount[uid] ?? 0,
    isCreator: uid === (league.created_by as string),
  }))

  // Trier par % décroissant
  members.sort((a, b) => b.pct - a.pct)

  const isCreator = user.id === (league.created_by as string)

  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-10" style={{ backgroundColor: '#0a1628' }}>
      <div className="mx-auto max-w-2xl space-y-8">

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link
              href="/leagues"
              className="mb-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Mes ligues
            </Link>
            <h1 className="text-3xl font-black text-white">
              {league.name as string}
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: '#64748b' }}>
              {members.length} membre{members.length !== 1 ? 's' : ''}
            </p>
          </div>
          <LeaveButton leagueId={id} />
        </div>

        {/* ── Code d'invitation ── */}
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: '#64748b' }}>
            Code d&apos;invitation
          </p>
          <div className="flex items-center gap-3">
            <code
              className="flex-1 rounded-lg border border-white/10 bg-black/30 px-4 py-2 text-lg font-mono font-bold tracking-widest"
              style={{ color: '#ffd60a' }}
            >
              {league.invite_code as string}
            </code>
            <CopyButton code={league.invite_code as string} />
          </div>
        </div>

        {/* ── Classement membres ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Classement</h2>
            <Link
              href={`/leagues/${id}/echanges`}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Voir les échanges →
            </Link>
          </div>

          <ul className="space-y-2">
            {members.map((member, idx) => (
              <li
                key={member.user_id}
                className={`flex items-center gap-4 rounded-xl border px-5 py-3.5 ${
                  member.user_id === user.id
                    ? 'border-red-600/40 bg-red-900/10'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                {/* Rang */}
                <span
                  className="w-6 shrink-0 text-center text-sm font-bold tabular-nums"
                  style={{ color: idx === 0 ? '#ffd60a' : '#64748b' }}
                >
                  {idx + 1}
                </span>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white truncate">{member.username}</span>
                    {member.isCreator && (
                      <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: 'rgba(220,38,38,0.2)', color: '#f87171' }}>
                        admin
                      </span>
                    )}
                    {member.user_id === user.id && (
                      <span className="shrink-0 text-[10px] text-gray-500">(toi)</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 max-w-[120px] overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-red-500"
                        style={{ width: `${member.pct}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums" style={{ color: '#64748b' }}>
                      {member.pct}%
                    </span>
                  </div>
                </div>

                {/* Badges */}
                <div className="shrink-0 flex items-center gap-1 text-sm" style={{ color: '#64748b' }}>
                  <span>{member.badgeCount}</span>
                  <span>🏅</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

      </div>
    </main>
  )
}
