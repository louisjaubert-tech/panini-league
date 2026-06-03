'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import Image from 'next/image'
import { fetchDashboardData, type DashboardData, type Badge, type PackOpening } from '@/app/actions/dashboard'

// Client Supabase côté navigateur (uniquement pour les souscriptions Realtime)
const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function StatCard({
  label,
  value,
  sub,
  colorClass,
  icon,
}: {
  label: string
  value: string | number
  sub?: string
  colorClass: string
  icon: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl p-6 ${colorClass} flex items-start gap-4`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium opacity-75">{label}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-sm opacity-70">{sub}</p>}
      </div>
    </div>
  )
}

function OcrBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:    { label: 'En attente', cls: 'bg-yellow-100 text-yellow-700' },
    processing: { label: 'Analyse…',   cls: 'bg-blue-100 text-blue-700' },
    done:       { label: 'Analysé',    cls: 'bg-green-100 text-green-700' },
    error:      { label: 'Erreur',     cls: 'bg-red-100 text-red-700' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

export default function DashboardClient({
  userId,
  initial,
}: {
  userId: string
  initial: DashboardData
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_stickers',  filter: `user_id=eq.${userId}` },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_badges',    filter: `user_id=eq.${userId}` },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pack_openings',  filter: `user_id=eq.${userId}` },
        () => refresh()
      )
      .subscribe()

    return () => {
      supabaseBrowser.removeChannel(channel)
    }
  }, [userId, refresh])

  const { uniqueCards, totalReference, completionPct, duplicates, countries, recentBadges, recentPacks } = data

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

      {/* ── Stats ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-700">Ma collection</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Cartes uniques"
            value={uniqueCards}
            sub={`sur ${totalReference} au total`}
            colorClass="bg-indigo-600 text-white"
            icon={
              <svg className="h-6 w-6 opacity-80" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
            }
          />
          <StatCard
            label="Album complété"
            value={`${completionPct} %`}
            colorClass="bg-emerald-500 text-white"
            icon={
              <svg className="h-6 w-6 opacity-80" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Doublons"
            value={duplicates}
            colorClass="bg-amber-400 text-white"
            icon={
              <svg className="h-6 w-6 opacity-80" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
              </svg>
            }
          />
          <StatCard
            label="Pays représentés"
            value={countries}
            colorClass="bg-sky-500 text-white"
            icon={
              <svg className="h-6 w-6 opacity-80" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            }
          />
        </div>
      </section>

      {/* ── Barre de progression ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Progression album</span>
          <span className="text-sm font-semibold text-indigo-600">{completionPct} %</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-700"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">{uniqueCards} / {totalReference} cartes</p>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ── Derniers badges ── */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-700">Derniers badges</h2>
          {recentBadges.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
              Aucun badge débloqué pour l&apos;instant
            </div>
          ) : (
            <ul className="space-y-3">
              {recentBadges.map((badge: Badge) => (
                <li
                  key={badge.id}
                  className="flex items-center gap-4 rounded-2xl bg-white border border-gray-100 px-5 py-4 shadow-sm"
                >
                  <span className="text-3xl leading-none" role="img" aria-label={badge.name}>
                    {badge.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{badge.name}</p>
                    <p className="text-xs text-gray-500 truncate">{badge.description}</p>
                  </div>
                  <time className="ml-auto shrink-0 text-xs text-gray-400 tabular-nums">
                    {new Date(badge.earned_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Derniers blisters ── */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-700">Derniers blisters</h2>
          {recentPacks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
              Aucun blister scanné pour l&apos;instant
            </div>
          ) : (
            <ul className="space-y-3">
              {recentPacks.map((pack: PackOpening) => (
                <li
                  key={pack.id}
                  className="flex items-center gap-4 rounded-2xl bg-white border border-gray-100 px-5 py-4 shadow-sm"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    {pack.photo_url ? (
                      <Image
                        src={pack.photo_url}
                        alt="Blister"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008v.008H13.5V12zm-6 3.75h12a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      Blister du{' '}
                      {new Date(pack.opened_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'long',
                      })}
                    </p>
                    <OcrBadge status={pack.ocr_status} />
                  </div>
                  <time className="ml-auto shrink-0 text-xs text-gray-400 tabular-nums">
                    {new Date(pack.opened_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
