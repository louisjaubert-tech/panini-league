'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
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

  if (leagues.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
        <p className="mb-4 text-sm text-gray-500">
          Tu dois faire partie d&apos;une ligue pour accéder aux échanges.
        </p>
        <Link
          href="/leagues"
          className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#f97316' }}
        >
          Rejoins une ligue →
        </Link>
      </div>
    )
  }

  const load = useCallback((leagueId: string) => {
    setError(null)
    setData(null)
    startTransition(async () => {
      const result = await getExchangeData(leagueId)
      if ('error' in result) {
        setError(result.error)
      } else {
        setData(result)
      }
    })
  }, [])

  // Auto-chargement dès que la ligue sélectionnée change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedId) load(selectedId) }, [selectedId])

  return (
    <div className="space-y-5">
      {/* Sélecteur de ligue */}
      {leagues.length > 1 && (
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
        >
          {leagues.map((l) => (
            <option key={l.id} value={l.id} style={{ backgroundColor: '#0a1628' }}>
              {l.name}
            </option>
          ))}
        </select>
      )}

      {isPending && (
        <div className="py-8 text-center text-sm text-gray-500">Chargement…</div>
      )}

      {error && (
        <p className="rounded-xl border border-red-600/30 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {data && !isPending && (
        <EchangesClient
          data={{ ...data, currentUserId }}
          leagueId={selectedId}
          onReload={() => load(selectedId)}
        />
      )}
    </div>
  )
}
