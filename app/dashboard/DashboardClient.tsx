'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase as supabaseBrowser } from '@/lib/supabase'
import { fetchDashboardData, type DashboardData } from '@/app/actions/dashboard'
import BadgesClient, { type BadgeWithProgress } from '@/app/badges/BadgesClient'

export default function DashboardClient({
  userId,
  initial,
  badges,
}: {
  userId: string
  initial: DashboardData
  badges: BadgeWithProgress[]
}) {
  const [data, setData] = useState<DashboardData>(initial)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    const fresh = await fetchDashboardData()
    if (fresh) setData(fresh)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    const channel = supabaseBrowser
      .channel(`dashboard:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_collection', filter: `user_id=eq.${userId}` }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_badges',    filter: `user_id=eq.${userId}` }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pack_openings',  filter: `user_id=eq.${userId}` }, () => refresh())
      .subscribe()
    return () => { supabaseBrowser.removeChannel(channel) }
  }, [userId, refresh])

  const { uniqueCards, totalReference, completionPct, duplicates, countries, totalPacks } = data
  const earnedBadgesCount = badges.filter((b) => b.earned).length

  return (
    <div className="space-y-10">

      {/* Indicateur de rafraîchissement */}
      {refreshing && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Mise à jour…
        </div>
      )}

      {/* ── 📖 Barre de progression album ── */}
      <section className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-300">📖 Progression album</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: completionPct >= 50 ? '#ffd60a' : '#e5e7eb' }}>
            {completionPct} %
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${completionPct}%`, backgroundColor: '#f97316' }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-400 tabular-nums">{uniqueCards} / {totalReference} stickers</p>
      </section>

      {/* ── 4 petites stats ── */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { emoji: '📦', label: 'Doublons',          value: duplicates },
            { emoji: '🌍', label: 'Pays représentés',  value: countries },
            { emoji: '🏅', label: 'Badges obtenus',    value: earnedBadgesCount },
            { emoji: '📸', label: 'Blisters scannés',  value: totalPacks },
          ].map(({ emoji, label, value }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center">
              <p className="text-lg mb-1">{emoji}</p>
              <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Mes badges (pleine largeur, deux colonnes côte à côte) ── */}
      {badges.length > 0 && (
        <section>
          <BadgesClient badges={badges} sideLayout />
        </section>
      )}

    </div>
  )
}
