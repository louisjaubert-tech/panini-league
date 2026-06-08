'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback, useTransition, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  fetchLeaderboard,
  fetchLeagueLeaderboard,
  fetchLeagueTrophies,
  type LeaderboardRow,
  type LeagueMemberRow,
  type LeagueTrophyRow,
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
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular-nums text-sm font-medium text-gray-700">{pct}&nbsp;%</span>
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
      <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr className="bg-gray-50">
              <th className="py-3.5 pl-6 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Rang</th>
              <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Joueur</th>
              <th className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Cartes uniques</th>
              <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Album complété</th>
              <th className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Badges</th>
              <th className="py-3.5 pl-3 pr-6 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Pays</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-sm text-gray-400">
                  Aucun joueur pour l&apos;instant
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.userId}
                  className={`transition-colors hover:bg-gray-50/60 ${row.rank <= 3 ? 'bg-indigo-50/30' : ''}`}
                >
                  <td className="py-4 pl-6 pr-3"><RankBadge rank={row.rank} /></td>
                  <td className="px-3 py-4"><span className="font-semibold text-gray-900">{row.username}</span></td>
                  <td className="px-3 py-4 text-right">
                    <span className="tabular-nums text-lg font-bold text-indigo-600">{row.uniqueCards}</span>
                  </td>
                  <td className="px-3 py-4"><ProgressBar pct={row.completionPct} /></td>
                  <td className="px-3 py-4 text-right">
                    <span className="inline-flex items-center gap-1 tabular-nums text-sm font-medium text-gray-700">
                      <span>{row.badgeCount}</span><span className="text-base leading-none">🏅</span>
                    </span>
                  </td>
                  <td className="py-4 pl-3 pr-6 text-right">
                    <span className="inline-flex items-center gap-1 tabular-nums text-sm font-medium text-gray-700">
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
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
            Aucun joueur pour l&apos;instant
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.userId}
              className={`rounded-2xl border bg-white px-5 py-4 shadow-sm ${row.rank <= 3 ? 'border-indigo-200' : 'border-gray-100'}`}
            >
              <div className="flex items-center gap-3">
                <RankBadge rank={row.rank} />
                <span className="flex-1 font-semibold text-gray-900">{row.username}</span>
                <span className="tabular-nums text-xl font-bold text-indigo-600">
                  {row.uniqueCards}
                  <span className="ml-0.5 text-xs font-normal text-gray-400"> cartes</span>
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-50 pt-3">
                <div className="text-center">
                  <p className="text-xs text-gray-400">Album</p>
                  <p className="tabular-nums text-sm font-semibold text-gray-700">{row.completionPct}&nbsp;%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Badges</p>
                  <p className="text-sm font-semibold text-gray-700">{row.badgeCount} 🏅</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Pays</p>
                  <p className="text-sm font-semibold text-gray-700">{row.countries} 🌍</p>
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
  { trophy_id: 'lt01', name: 'Trophée Platine' },
  { trophy_id: 'lt02', name: 'Trophée du Pionnier' },
  { trophy_id: 'lt03', name: 'Trophée Jules Rimet' },
  { trophy_id: 'lt04', name: 'Trophée MasterPoulet' },
  { trophy_id: 'lt05', name: 'Trophée Galette Saucisse' },
  { trophy_id: 'lt06', name: 'Trophée du Repos Bien Mérité' },
  { trophy_id: 'lt07', name: 'Trophée des Grosses Boules Dorées' },
  { trophy_id: 'lt08', name: 'Trophée Lev Yachine' },
]

function TrophiesSection({ trophies, loading }: { trophies: LeagueTrophyRow[]; loading: boolean }) {
  const [open, setOpen] = useState(true)

  const earnedIds = useMemo(() => new Set(trophies.map((t) => t.trophy_id)), [trophies])

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
            {ALL_TROPHIES.map(({ trophy_id, name }) => {
              const earned = trophies.find((t) => t.trophy_id === trophy_id)
              if (earned) {
                const date = new Date(earned.obtained_at).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })
                return (
                  <li
                    key={trophy_id}
                    className="flex items-center gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3"
                  >
                    <span className="text-lg shrink-0">🏆</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{name}</p>
                      <p className="text-xs text-gray-400">
                        Remporté par{' '}
                        <span style={{ color: '#ffd60a' }}>{earned.username}</span>
                        {' · '}{date}
                      </p>
                    </div>
                  </li>
                )
              }
              return (
                <li
                  key={trophy_id}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/3 px-4 py-3 opacity-45"
                >
                  <span className="text-lg shrink-0">🔒</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-400 truncate">{name}</p>
                    <p className="text-xs text-gray-600">Pas encore remporté</p>
                  </div>
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

  if (!currentUserId || userLeagues.length === 0) {
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
        <ul className="space-y-2">
          {members.map((member) => (
            <li
              key={member.userId}
              className={`flex items-center gap-4 rounded-xl border px-5 py-3.5 ${
                member.isCurrentUser
                  ? 'border-red-600/40 bg-red-900/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <span
                className="w-6 shrink-0 text-center text-sm font-bold tabular-nums"
                style={{ color: member.rank === 1 ? '#ffd60a' : '#64748b' }}
              >
                {member.rank}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white truncate">{member.username}</span>
                  {member.isCurrentUser && (
                    <span className="shrink-0 text-[10px] text-gray-500">(toi)</span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 max-w-[120px] overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${member.pct}%` }} />
                  </div>
                  <span className="text-xs tabular-nums text-gray-500">{member.pct}%</span>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1 text-sm text-gray-500">
                <span>{member.badgeCount}</span>
                <span>🏅</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Trophées de la ligue */}
      <div className="border-t border-white/10 pt-6">
        <TrophiesSection trophies={trophies} loading={trophiesLoading} />
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
            { key: 'league', label: '👥 Ma ligue' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === key
                ? 'bg-[#dc2626] text-white shadow'
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
