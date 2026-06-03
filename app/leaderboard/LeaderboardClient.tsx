'use client'

import { useEffect, useState, useCallback, useTransition } from 'react'
import { fetchLeaderboard, type LeaderboardRow } from '@/app/actions/leaderboard'

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

export default function LeaderboardClient({
  initial,
}: {
  initial: LeaderboardRow[]
}) {
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

  // Auto-refresh toutes les 30 secondes
  useEffect(() => {
    const timer = setInterval(refresh, REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [refresh])

  // Compte à rebours visuel
  useEffect(() => {
    const tick = setInterval(
      () => setCountdown((c) => (c > 0 ? c - 1 : REFRESH_INTERVAL / 1000)),
      1000
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
              <th className="py-3.5 pl-6 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Rang
              </th>
              <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Joueur
              </th>
              <th className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Cartes uniques
              </th>
              <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Album complété
              </th>
              <th className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Badges
              </th>
              <th className="py-3.5 pl-3 pr-6 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Pays
              </th>
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
                  className={`transition-colors hover:bg-gray-50/60 ${
                    row.rank <= 3 ? 'bg-indigo-50/30' : ''
                  }`}
                >
                  <td className="py-4 pl-6 pr-3">
                    <RankBadge rank={row.rank} />
                  </td>
                  <td className="px-3 py-4">
                    <span className="font-semibold text-gray-900">{row.username}</span>
                  </td>
                  <td className="px-3 py-4 text-right">
                    <span className="tabular-nums text-lg font-bold text-indigo-600">
                      {row.uniqueCards}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <ProgressBar pct={row.completionPct} />
                  </td>
                  <td className="px-3 py-4 text-right">
                    <span className="inline-flex items-center gap-1 tabular-nums text-sm font-medium text-gray-700">
                      <span>{row.badgeCount}</span>
                      <span className="text-base leading-none">🏅</span>
                    </span>
                  </td>
                  <td className="py-4 pl-3 pr-6 text-right">
                    <span className="inline-flex items-center gap-1 tabular-nums text-sm font-medium text-gray-700">
                      <span>{row.countries}</span>
                      <span className="text-base leading-none">🌍</span>
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
              className={`rounded-2xl border bg-white px-5 py-4 shadow-sm ${
                row.rank <= 3 ? 'border-indigo-200' : 'border-gray-100'
              }`}
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
                  <p className="tabular-nums text-sm font-semibold text-gray-700">
                    {row.completionPct}&nbsp;%
                  </p>
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
