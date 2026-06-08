'use client'

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type BadgeWithProgress = {
  badge_id: string
  name: string
  description: string
  condition_type: string
  condition_value: number
  points: number
  earned: boolean
  progress: number   // 0–100
  obtained_at: string | null
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function ProgressBar({ pct, color = '#dc2626' }: { pct: number; color?: string }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="shrink-0 tabular-nums text-xs text-gray-500">{pct}%</span>
    </div>
  )
}

function PointsPill({ points }: { points: number }) {
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
      style={{ backgroundColor: 'rgba(255,214,10,0.15)', color: '#ffd60a' }}
    >
      {points} pts
    </span>
  )
}

function BadgeIcon({ earned, progress }: { earned: boolean; progress: number }) {
  if (earned) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
        style={{ backgroundColor: 'rgba(255,214,10,0.15)' }}>
        🏅
      </span>
    )
  }
  if (progress > 0) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
        style={{ backgroundColor: 'rgba(220,38,38,0.12)' }}>
        ⏳
      </span>
    )
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl bg-white/5">
      🔒
    </span>
  )
}

// ── Carte badge obtenu ────────────────────────────────────────────────────────

function EarnedCard({ badge }: { badge: BadgeWithProgress }) {
  const date = badge.obtained_at
    ? new Date(badge.obtained_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <li className="flex items-start gap-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-4">
      <BadgeIcon earned progress={100} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-white">{badge.name}</span>
          <PointsPill points={badge.points} />
        </div>
        <p className="mt-0.5 text-xs text-gray-400">{badge.description}</p>
        {date && (
          <p className="mt-1 text-[10px] text-gray-600">Obtenu le {date}</p>
        )}
      </div>
    </li>
  )
}

// ── Carte badge en progression ────────────────────────────────────────────────

function ProgressCard({ badge }: { badge: BadgeWithProgress }) {
  return (
    <li className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
      <BadgeIcon earned={false} progress={badge.progress} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-white">{badge.name}</span>
          <PointsPill points={badge.points} />
        </div>
        <p className="mt-0.5 text-xs text-gray-400">{badge.description}</p>
        <ProgressBar pct={badge.progress} />
      </div>
    </li>
  )
}

// ── Carte badge verrouillé ────────────────────────────────────────────────────

function LockedCard({ badge }: { badge: BadgeWithProgress }) {
  return (
    <li className="flex items-start gap-4 rounded-2xl border border-white/5 bg-white/3 px-5 py-4 opacity-50">
      <BadgeIcon earned={false} progress={0} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gray-400">{badge.name}</span>
          <PointsPill points={badge.points} />
        </div>
        <p className="mt-0.5 text-xs text-gray-600">{badge.description}</p>
      </div>
    </li>
  )
}

// ── Section avec collapse ─────────────────────────────────────────────────────

function Section({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string
  count: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 mb-3 group"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-bold"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#9ca3af' }}
          >
            {count}
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && children}
    </section>
  )
}

// ── Export principal ──────────────────────────────────────────────────────────

export default function BadgesClient({ badges }: { badges: BadgeWithProgress[] }) {
  const earned = badges.filter((b) => b.earned)
  const inProgress = badges.filter((b) => !b.earned && b.progress > 0)
  const locked = badges.filter((b) => !b.earned && b.progress === 0)

  return (
    <div className="space-y-8">
      {/* Badges obtenus */}
      <Section title="🏅 Badges obtenus" count={earned.length}>
        {earned.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-gray-600">
            Aucun badge encore obtenu.
          </div>
        ) : (
          <ul className="space-y-3">
            {earned.map((b) => <EarnedCard key={b.badge_id} badge={b} />)}
          </ul>
        )}
      </Section>

      {/* En progression */}
      <Section title="⏳ En progression" count={inProgress.length}>
        {inProgress.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-gray-600">
            Commence à scanner des stickers pour débloquer des progressions.
          </div>
        ) : (
          <ul className="space-y-3">
            {inProgress
              .sort((a, b) => b.progress - a.progress)
              .map((b) => <ProgressCard key={b.badge_id} badge={b} />)}
          </ul>
        )}
      </Section>

      {/* Verrouillés */}
      <Section title="🔒 Badges verrouillés" count={locked.length} defaultOpen={false}>
        {locked.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-gray-600">
            Tous les badges sont débloqués !
          </div>
        ) : (
          <ul className="space-y-2">
            {locked.map((b) => <LockedCard key={b.badge_id} badge={b} />)}
          </ul>
        )}
      </Section>
    </div>
  )
}
