'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { supabase as supabaseBrowser } from '@/lib/supabase'
import { fetchDashboardData, type DashboardData, type Badge, type PackOpening } from '@/app/actions/dashboard'
import BadgesClient, { type BadgeWithProgress } from '@/app/badges/BadgesClient'

function OcrBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:    { label: 'En attente', cls: 'bg-yellow-500/20 text-yellow-300' },
    processing: { label: 'Analyse…',   cls: 'bg-blue-500/20 text-blue-300' },
    done:       { label: 'Analysé',    cls: 'bg-green-500/20 text-green-300' },
    error:      { label: 'Erreur',     cls: 'bg-red-500/20 text-red-400' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-white/10 text-gray-400' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

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

  const { uniqueCards, totalReference, completionPct, duplicates, countries, recentBadges, recentPacks, totalPacks } = data
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

      {/* ── Derniers badges + blisters ── */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Derniers badges */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Derniers badges</h2>
          {recentBadges.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-gray-500">
              Aucun badge débloqué pour l&apos;instant
            </div>
          ) : (
            <ul className="space-y-3">
              {recentBadges.map((badge: Badge) => (
                <li key={badge.badge_id} className="flex items-center gap-4 rounded-2xl bg-white/10 border border-white/10 px-5 py-4">
                  <span className="text-3xl leading-none" role="img" aria-label={badge.name}>🏅</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{badge.name}</p>
                    <p className="text-xs text-gray-400 truncate">{badge.description}</p>
                  </div>
                  <time className="ml-auto shrink-0 text-xs text-gray-500 tabular-nums">
                    {new Date(badge.obtained_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Derniers blisters */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Derniers blisters</h2>
          {recentPacks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-gray-500">
              Aucun blister scanné pour l&apos;instant
            </div>
          ) : (
            <ul className="space-y-3">
              {recentPacks.map((pack: PackOpening) => (
                <li key={pack.id} className="flex items-center gap-4 rounded-2xl bg-white/10 border border-white/10 px-5 py-4">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/10">
                    {pack.photo_url ? (
                      <Image src={pack.photo_url} alt="Blister" fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008v.008H13.5V12zm-6 3.75h12a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">
                      Blister du{' '}
                      {new Date(pack.opened_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}
                    </p>
                    <OcrBadge status={pack.ocr_status} />
                  </div>
                  <time className="ml-auto shrink-0 text-xs text-gray-500 tabular-nums">
                    {new Date(pack.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Mes badges ── */}
      {badges.length > 0 && (
        <section>
          <h2 className="mb-6 text-lg font-semibold text-white">🏅 Mes badges</h2>
          <BadgesClient badges={badges} />
        </section>
      )}

    </div>
  )
}
