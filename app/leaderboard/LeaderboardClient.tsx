'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback, useTransition, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  fetchLeaderboard,
  fetchLeagueLeaderboard,
  fetchLeagueTrophies,
  fetchTrophyProgress,
  type LeaderboardRow,
  type LeagueMemberRow,
  type LeagueTrophyRow,
  type TrophyProgressRow,
} from '@/app/actions/leaderboard'
import type { UserLeague } from './page'

const REFRESH_INTERVAL = 30_000

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-sm font-bold text-white shadow-sm">
        🥇
      </span>
    )
  if (rank === 2)
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-sm font-bold text-white shadow-sm">
        🥈
      </span>
    )
  if (rank === 3)
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 text-sm font-bold text-white shadow-sm">
        🥉
      </span>
    )
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-500">
      {rank}
    </span>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: '#f97316' }}
        />
      </div>
      <span className="tabular-nums text-sm font-medium text-gray-400">{pct}&nbsp;%</span>
    </div>
  )
}

// ── Onglet Général ────────────────────────────────────────────────────────────

function GeneralTab({ initial }: { initial: LeaderboardRow[] }) {
  const [rows, setRows] = useState<LeaderboardRow[]>(initial)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const [isPending, startTransition] = useTransition()

  const refresh = useCallback(() => {
    startTransition(async () => {
      const fresh = await fetchLeaderboard()
      setRows(fresh)
      setLastUpdated(new Date())
      setCountdown(REFRESH_INTERVAL / 1000)
    })
  }, [])

  useEffect(() => {
    const timer = setInterval(refresh, REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [refresh])

  useEffect(() => {
    const tick = setInterval(
      () => setCountdown((c) => (c > 0 ? c - 1 : REFRESH_INTERVAL / 1000)),
      1000,
    )
    return () => clearInterval(tick)
  }, [lastUpdated])

  return (
    <div className="space-y-4">
      {/* Barre de statut */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Mis à jour à{' '}
          {lastUpdated.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </p>
        <div className="flex items-center gap-3">
          {isPending && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Actualisation…
            </span>
          )}
          <span className="text-xs text-gray-400">
            Prochain refresh dans{' '}
            <span className="tabular-nums font-medium text-gray-600">{countdown}s</span>
          </span>
          <button
            onClick={refresh}
            disabled={isPending}
            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            ↻ Actualiser
          </button>
        </div>
      </div>

      {/* Tableau desktop */}
      <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:block">
        <table className="min-w-full divide-y divide-white/5">
          <thead>
            <tr className="bg-white/5">
              <th className="py-3.5 pl-6 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Rang</th>
              <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Joueur</th>
              <th className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Cartes uniques</th>
              <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Album complété</th>
              <th className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Badges</th>
              <th className="py-3.5 pl-3 pr-6 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Pays</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-sm text-gray-500">
                  Aucun joueur pour l&apos;instant
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.userId}
                  className={`transition-colors hover:bg-white/5 ${row.rank <= 3 ? 'bg-yellow-500/5' : ''}`}
                >
                  <td className="py-4 pl-6 pr-3"><RankBadge rank={row.rank} /></td>
                  <td className="px-3 py-4"><span className="font-semibold text-white">{row.username}</span></td>
                  <td className="px-3 py-4 text-right">
                    <span className="tabular-nums text-lg font-bold" style={{ color: '#ffd60a' }}>{row.uniqueCards}</span>
                  </td>
                  <td className="px-3 py-4"><ProgressBar pct={row.completionPct} /></td>
                  <td className="px-3 py-4 text-right">
                    <span className="inline-flex items-center gap-1 tabular-nums text-sm font-medium text-gray-400">
                      <span>{row.badgeCount}</span><span className="text-base leading-none">🏅</span>
                    </span>
                  </td>
                  <td className="py-4 pl-3 pr-6 text-right">
                    <span className="inline-flex items-center gap-1 tabular-nums text-sm font-medium text-gray-400">
                      <span>{row.countries}</span><span className="text-base leading-none">🌍</span>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cards mobile */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-gray-500">
            Aucun joueur pour l&apos;instant
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.userId}
              className={`rounded-2xl border px-5 py-4 ${row.rank <= 3 ? 'border-yellow-500/20 bg-yellow-500/5' : 'border-white/10 bg-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <RankBadge rank={row.rank} />
                <span className="flex-1 font-semibold text-white">{row.username}</span>
                <span className="tabular-nums text-xl font-bold" style={{ color: '#ffd60a' }}>
                  {row.uniqueCards}
                  <span className="ml-0.5 text-xs font-normal text-gray-500"> cartes</span>
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/5 pt-3">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Album</p>
                  <p className="tabular-nums text-sm font-semibold text-white">{row.completionPct}&nbsp;%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Badges</p>
                  <p className="text-sm font-semibold text-white">{row.badgeCount} 🏅</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Pays</p>
                  <p className="text-sm font-semibold text-white">{row.countries} 🌍</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Section trophées de la ligue ─────────────────────────────────────────────

const ALL_TROPHIES = [
  { trophy_id: 'b11', name: 'Trophée Platine',              description: "Premier à compléter l'album entier (960 stickers)" },
  { trophy_id: 'b12', name: 'Trophée Équipe Complète',      description: 'Premier à compléter une équipe nationale entière' },
  { trophy_id: 'b13', name: 'Trophée Jules Rimet',          description: "Premier à avoir les 4 stickers de l'Histoire de la Coupe du Monde (106, 107, 108, 109)" },
  { trophy_id: 'b14', name: 'Trophée La France',            description: "Premier à compléter la double page de l'équipe de France" },
  { trophy_id: 'b15', name: 'Trophée Galette Saucisse',     description: 'Premier à avoir les 4 joueurs du Stade Rennais : JOR15, GHA5, CIV11, SUI17' },
  { trophy_id: 'b16', name: 'Trophée Repos Bien Mérité',    description: 'Premier à avoir les 6 Lee de Corée du Sud : KOR7, KOR8, KOR9, KOR10, KOR12, KOR16' },
  { trophy_id: 'b17', name: 'Trophée Grosses Boules Dorées', description: "Premier à avoir tous les Ballons d'Or : ESP10, FRA15, ARG17, POR15, CRO9" },
  { trophy_id: 'b18', name: 'Trophée Lev Yachine',          description: 'Premier à avoir tous les gardiens titulaires de l\'album (les X2 de chaque sélection)' },
]

function TrophiesSection({
  trophies,
  loading,
  leagueId,
}: {
  trophies: LeagueTrophyRow[]
  loading: boolean
  leagueId: string
}) {
  const [open, setOpen] = useState(true)
  // trophyId ouvert pour la progression, null = aucun
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // cache : trophyId → résultats
  const [progressCache, setProgressCache] = useState<Map<string, TrophyProgressRow[]>>(new Map())
  const [loadingTrophy, setLoadingTrophy] = useState<string | null>(null)

  const earnedIds = useMemo(() => new Set(trophies.map((t) => t.trophy_id)), [trophies])

  async function handleTrophyClick(trophy_id: string) {

    // Toggle
    if (expandedId === trophy_id) {
      setExpandedId(null)
      return
    }

    setExpandedId(trophy_id)

    // Déjà en cache
    if (progressCache.has(trophy_id)) return

    setLoadingTrophy(trophy_id)
    const rows = await fetchTrophyProgress(leagueId, trophy_id)
    setProgressCache((prev) => new Map(prev).set(trophy_id, rows))
    setLoadingTrophy(null)
  }

  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 mb-3"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">🏆 Trophées de la ligue</h3>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-bold"
            style={{ backgroundColor: 'rgba(255,214,10,0.12)', color: '#ffd60a' }}
          >
            {trophies.length} / {ALL_TROPHIES.length}
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        loading ? (
          <div className="py-6 text-center text-xs text-gray-500">Chargement…</div>
        ) : (
          <ul className="space-y-2">
            {ALL_TROPHIES.map(({ trophy_id, name, description }) => {
              const earned = trophies.find((t) => t.trophy_id === trophy_id)

              if (earned) {
                const date = new Date(earned.obtained_at).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })
                const isExpanded = expandedId === trophy_id
                const isLoadingThis = loadingTrophy === trophy_id
                const progressRows = progressCache.get(trophy_id)

                return (
                  <li key={trophy_id}>
                    <button
                      onClick={() => handleTrophyClick(trophy_id)}
                      className={`w-full flex items-start gap-3 rounded-xl border border-yellow-500/20 px-4 py-3 text-left transition-colors cursor-pointer ${
                        isExpanded ? 'bg-yellow-500/10' : 'bg-yellow-500/5 hover:bg-yellow-500/10'
                      }`}
                    >
                      <span className="text-lg shrink-0 mt-0.5">🏆</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">{name}</p>
                          <svg
                            className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                        <p className="text-xs mt-1" style={{ color: '#4ade80' }}>
                          🏆 Remporté par{' '}
                          <span style={{ color: '#ffd60a' }}>{earned.username}</span>
                          {' '}le {date}
                        </p>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-2">
                        {isLoadingThis ? (
                          <p className="text-xs text-gray-500 text-center py-2">Chargement…</p>
                        ) : progressRows && progressRows.length > 0 ? (
                          <>
                            <p className="text-xs font-medium text-gray-500 mb-2">Progression des membres</p>
                            {progressRows.map((row, idx) => {
                              const isLeader = idx === 0 && row.progress > 0
                              return (
                                <div key={row.userId} className="flex items-center gap-3">
                                  <span
                                    className="w-20 shrink-0 truncate text-xs font-medium"
                                    style={{ color: isLeader ? '#ffd60a' : '#9ca3af' }}
                                  >
                                    {isLeader && '⭐ '}{row.username}
                                  </span>
                                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                                    <div
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{
                                        width: `${row.progress}%`,
                                        backgroundColor: isLeader ? '#ffd60a' : '#f97316',
                                      }}
                                    />
                                  </div>
                                  <span
                                    className="w-9 shrink-0 text-right text-xs tabular-nums"
                                    style={{ color: isLeader ? '#ffd60a' : '#6b7280' }}
                                  >
                                    {row.progress}%
                                  </span>
                                </div>
                              )
                            })}
                          </>
                        ) : (
                          <p className="text-xs text-gray-600 text-center py-1">Aucune donnée</p>
                        )}
                      </div>
                    )}
                  </li>
                )
              }

              // ── Trophée non remporté — cliquable ──
              const isExpanded = expandedId === trophy_id
              const isLoadingThis = loadingTrophy === trophy_id
              const progressRows = progressCache.get(trophy_id)

              return (
                <li key={trophy_id}>
                  <button
                    onClick={() => handleTrophyClick(trophy_id)}
                    className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer ${
                      isExpanded
                        ? 'border-white/15 bg-white/8 opacity-70'
                        : 'border-white/5 bg-white/[0.03] opacity-45 hover:opacity-60 hover:border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-lg shrink-0 mt-0.5">🔒</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-400">{name}</p>
                        <svg
                          className={`h-3.5 w-3.5 shrink-0 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                      <p className="text-xs text-gray-600 mt-1">Pas encore remporté</p>
                    </div>
                  </button>

                  {/* Liste de progression déroulante */}
                  {isExpanded && (
                    <div className="mt-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-2">
                      {isLoadingThis ? (
                        <p className="text-xs text-gray-500 text-center py-2">Chargement…</p>
                      ) : progressRows && progressRows.length > 0 ? (
                        <>
                          <p className="text-xs font-medium text-gray-500 mb-2">Progression des membres</p>
                          {progressRows.map((row, idx) => {
                            const isLeader = idx === 0 && row.progress > 0
                            return (
                              <div key={row.userId} className="flex items-center gap-3">
                                <span
                                  className="w-20 shrink-0 truncate text-xs font-medium"
                                  style={{ color: isLeader ? '#ffd60a' : '#9ca3af' }}
                                >
                                  {isLeader && '⭐ '}{row.username}
                                </span>
                                <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${row.progress}%`,
                                      backgroundColor: isLeader ? '#ffd60a' : '#f97316',
                                    }}
                                  />
                                </div>
                                <span
                                  className="w-9 shrink-0 text-right text-xs tabular-nums"
                                  style={{ color: isLeader ? '#ffd60a' : '#6b7280' }}
                                >
                                  {row.progress}%
                                </span>
                              </div>
                            )
                          })}
                        </>
                      ) : (
                        <p className="text-xs text-gray-600 text-center py-1">Aucune donnée</p>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )
      )}
    </section>
  )
}

// ── Onglet Ma ligue ───────────────────────────────────────────────────────────

function LeagueTab({
  userLeagues,
  currentUserId,
  initialLeagueId,
}: {
  userLeagues: UserLeague[]
  currentUserId: string | null
  initialLeagueId: string | null
}) {
  const [selectedId, setSelectedId] = useState<string>(
    () => initialLeagueId ?? userLeagues[0]?.id ?? '',
  )
  const [members, setMembers] = useState<LeagueMemberRow[]>([])
  const [trophies, setTrophies] = useState<LeagueTrophyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [trophiesLoading, setTrophiesLoading] = useState(false)
  const prevId = useRef<string>('')

  useEffect(() => {
    if (!selectedId || !currentUserId) return
    if (selectedId === prevId.current) return
    prevId.current = selectedId
    setLoading(true)
    setTrophiesLoading(true)
    Promise.all([
      fetchLeagueLeaderboard(selectedId, currentUserId),
      fetchLeagueTrophies(selectedId),
    ]).then(([membersData, trophiesData]) => {
      setMembers(membersData)
      setTrophies(trophiesData)
      setLoading(false)
      setTrophiesLoading(false)
    })
  }, [selectedId, currentUserId])

  if (!currentUserId) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/15 p-12 text-center">
        <p className="text-sm text-gray-400">
          Connecte-toi pour voir le classement de ta ligue.
        </p>
        <Link
          href="/register"
          className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#f97316' }}
        >
          S&apos;inscrire
        </Link>
      </div>
    )
  }

  if (userLeagues.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center">
        <p className="text-sm text-gray-400">
          Rejoins une ligue pour voir son classement{' '}
          <Link href="/leagues" className="font-semibold text-[#ffd60a] hover:underline">
            →
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sélecteur de ligue */}
      <select
        value={selectedId}
        onChange={(e) => {
          prevId.current = ''
          setSelectedId(e.target.value)
        }}
        className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[#ffd60a]/40"
      >
        {userLeagues.map((l) => (
          <option key={l.id} value={l.id} className="bg-[#0a1628]">
            {l.name}
          </option>
        ))}
      </select>

      {/* Classement membres */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">Chargement…</div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-gray-500">
          Aucun membre dans cette ligue.
        </div>
      ) : (
        <>
          {/* Tableau desktop */}
          <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:block">
            <table className="min-w-full divide-y divide-white/5">
              <thead>
                <tr className="bg-white/5">
                  <th className="py-3.5 pl-6 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Rang</th>
                  <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Joueur</th>
                  <th className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Stickers uniques</th>
                  <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Album complété</th>
                  <th className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Doublons</th>
                  <th className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Badges</th>
                  <th className="py-3.5 pl-3 pr-6 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Trophées</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {members.map((member) => (
                  <tr
                    key={member.userId}
                    className={`transition-colors hover:bg-white/5 ${
                      member.isCurrentUser ? 'bg-orange-500/5' : member.rank <= 3 ? 'bg-yellow-500/5' : ''
                    }`}
                  >
                    <td className="py-4 pl-6 pr-3"><RankBadge rank={member.rank} /></td>
                    <td className="px-3 py-4">
                      <span className="font-semibold text-white">{member.username}</span>
                      {member.isCurrentUser && (
                        <span className="ml-1.5 text-[10px] text-gray-500">(toi)</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-right">
                      <span className="tabular-nums text-lg font-bold" style={{ color: '#ffd60a' }}>{member.uniqueCards}</span>
                    </td>
                    <td className="px-3 py-4"><ProgressBar pct={member.pct} /></td>
                    <td className="px-3 py-4 text-right">
                      <span className="tabular-nums text-sm font-medium text-gray-400">{member.duplicates}</span>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <span className="inline-flex items-center gap-1 tabular-nums text-sm font-medium text-gray-400">
                        <span>{member.badgeCount}</span><span className="text-base leading-none">🏅</span>
                      </span>
                    </td>
                    <td className="py-4 pl-3 pr-6 text-right">
                      <span className="inline-flex items-center gap-1 tabular-nums text-sm font-medium text-gray-400">
                        <span>{member.trophyCount}</span><span className="text-base leading-none">🏆</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards mobile */}
          <div className="space-y-3 md:hidden">
            {members.map((member) => (
              <div
                key={member.userId}
                className={`rounded-2xl border px-5 py-4 ${
                  member.isCurrentUser
                    ? 'border-orange-500/40 bg-orange-500/10'
                    : member.rank <= 3
                    ? 'border-yellow-500/20 bg-yellow-500/5'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <RankBadge rank={member.rank} />
                  <span className="flex-1 font-semibold text-white truncate">{member.username}</span>
                  <span className="tabular-nums text-xl font-bold" style={{ color: '#ffd60a' }}>
                    {member.uniqueCards}
                    <span className="ml-0.5 text-xs font-normal text-gray-500"> stickers</span>
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 border-t border-white/5 pt-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Album</p>
                    <p className="tabular-nums text-sm font-semibold text-white">{member.pct}&nbsp;%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Doublons</p>
                    <p className="tabular-nums text-sm font-semibold text-white">{member.duplicates}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Badges</p>
                    <p className="text-sm font-semibold text-white">{member.badgeCount} 🏅</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Trophées</p>
                    <p className="text-sm font-semibold text-white">{member.trophyCount} 🏆</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Trophées de la ligue */}
      <div className="border-t border-white/10 pt-6">
        <TrophiesSection trophies={trophies} loading={trophiesLoading} leagueId={selectedId} />
      </div>
    </div>
  )
}

// ── Export principal ──────────────────────────────────────────────────────────

export default function LeaderboardClient({
  initial,
  userLeagues,
  currentUserId,
}: {
  initial: LeaderboardRow[]
  userLeagues: UserLeague[]
  currentUserId: string | null
}) {
  const searchParams = useSearchParams()
  const leagueParam = searchParams.get('league')

  const defaultTab = leagueParam ? 'league' : 'general'
  const [tab, setTab] = useState<'general' | 'league'>(defaultTab)

  return (
    <div className="space-y-6">
      {/* Onglets */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1 w-fit">
        {(
          [
            { key: 'general', label: '🌍 Général' },
            { key: 'league', label: '👥 Mes ligues' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === key
                ? 'bg-[#f97316] text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'general' ? (
        <GeneralTab initial={initial} />
      ) : (
        <LeagueTab
          userLeagues={userLeagues}
          currentUserId={currentUserId}
          initialLeagueId={leagueParam}
        />
      )}
    </div>
  )
}
