'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { getExchangeData, type ExchangeData } from '@/app/actions/trades'
import EchangesClient from '@/app/leagues/[id]/echanges/EchangesClient'
import type { UserLeagueSimple } from './page'

export default function EchangesPageClient({
  leagues,
  currentUserId,
}: {
  leagues: UserLeagueSimple[]
  currentUserId: string
}) {
  const [selectedId, setSelectedId] = useState<string>(leagues[0]?.id ?? '')
  const [data, setData] = useState<ExchangeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loadedLeagueId, setLoadedLeagueId] = useState<string | null>(null)

  if (leagues.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
        <p className="mb-4 text-sm text-gray-500">
          Tu dois faire partie d&apos;une ligue pour accéder aux échanges.
        </p>
        <Link
          href="/leagues"
          className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#dc2626' }}
        >
          Rejoins une ligue →
        </Link>
      </div>
    )
  }

  function load(leagueId: string) {
    setError(null)
    setData(null)
    setLoadedLeagueId(null)
    startTransition(async () => {
      const result = await getExchangeData(leagueId)
      if ('error' in result) {
        setError(result.error)
      } else {
        setData(result)
        setLoadedLeagueId(leagueId)
      }
    })
  }

  function handleChange(id: string) {
    setSelectedId(id)
  }

  return (
    <div className="space-y-5">
      {/* Sélecteur de ligue */}
      <div className="flex items-center gap-3">
        <select
          value={selectedId}
          onChange={(e) => handleChange(e.target.value)}
          className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-600/50"
        >
          {leagues.map((l) => (
            <option key={l.id} value={l.id} style={{ backgroundColor: '#0a1628' }}>
              {l.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => load(selectedId)}
          disabled={!selectedId || isPending}
          className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: '#dc2626' }}
        >
          {isPending ? 'Chargement…' : 'Voir les échanges'}
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-600/30 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {data && loadedLeagueId && (
        <EchangesClient data={{ ...data, currentUserId }} leagueId={loadedLeagueId} />
      )}
    </div>
  )
}
