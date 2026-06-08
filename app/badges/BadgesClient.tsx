'use client'

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

// ── Dictionnaire étoiles + descriptions overrides ─────────────────────────────

const BADGE_META: Record<string, { stars: number; description?: string }> = {
  b01: { stars: 1 },
  b02: { stars: 3, description: 'Avoir Messi (ARG17) ET Cristiano Ronaldo (POR15) dans sa collection' },
  b04: { stars: 2 },
  b05: { stars: 1, description: '50 doublons — à toi les dons et échanges avec les gens de ta ligue !' },
  b06: { stars: 2, description: 'Au moins 1 joueur de chacun des 32 pays participants à la Coupe du Monde 2026' },
  b08: { stars: 3 },
  b09: { stars: 3 },
  b10: { stars: 2 },
}

function getStars(badge_id: string): number {
  return BADGE_META[badge_id]?.stars ?? 2
}

function getDescription(badge: BadgeWithProgress): string {
  return BADGE_META[badge.badge_id]?.description ?? badge.description
}

function sortByStars(badges: BadgeWithProgress[]): BadgeWithProgress[] {
  return [...badges].sort((a, b) => getStars(a.badge_id) - getStars(b.badge_id))
}

// ── Étoiles de difficulté ─────────────────────────────────────────────────────

function StarRating({ badge_id }: { badge_id: string }) {
  const n = getStars(badge_id)
  return (
    <span className="flex items-center gap-0.5" title={`Difficulté : ${n}/3`}>
      {[1, 2, 3].map((i) => (
        <svg
          key={i}
          className="h-3 w-3"
          viewBox="0 0 20 20"
          fill={i <= n ? '#ffd60a' : 'none'}
          stroke={i <= n ? '#ffd60a' : '#4b5563'}
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
          />
        </svg>
      ))}
    </span>
  )
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function ProgressBar({ pct, color = '#f97316' }: { pct: number; color?: string }) {
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

function BadgeIcon({ earned, progress }: { earned: boolean; progress: number }) {
  if (earned)
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
        style={{ backgroundColor: 'rgba(255,214,10,0.15)' }}>
        🏅
      </span>
    )
  if (progress > 0)
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
        style={{ backgroundColor: 'rgba(220,38,38,0.12)' }}>
        ⏳
      </span>
    )
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl bg-white/5">
      🔒
    </span>
  )
}

// ── Cartes ────────────────────────────────────────────────────────────────────

function EarnedCard({ badge }: { badge: BadgeWithProgress }) {
  const date = badge.obtained_at
    ? new Date(badge.obtained_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

  return (
    <li className="flex items-start gap-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-4">
      <BadgeIcon earned progress={100} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-white">{badge.name}</span>
          <StarRating badge_id={badge.badge_id} />
        </div>
        <p className="mt-0.5 text-xs text-gray-400">{getDescription(badge)}</p>
        {date && <p className="mt-1 text-[10px] text-gray-600">Obtenu le {date}</p>}
      </div>
    </li>
  )
}

function NotEarnedCard({ badge }: { badge: BadgeWithProgress }) {
  const hasProgress = badge.progress > 0

  return (
    <li className={`flex items-start gap-4 rounded-2xl border px-5 py-4 ${
      hasProgress
        ? 'border-white/10 bg-white/5'
        : 'border-white/5 bg-white/[0.03] opacity-50'
    }`}>
      <BadgeIcon earned={false} progress={badge.progress} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-semibold ${hasProgress ? 'text-white' : 'text-gray-400'}`}>
            {badge.name}
          </span>
          <StarRating badge_id={badge.badge_id} />
        </div>
        <p className={`mt-0.5 text-xs ${hasProgress ? 'text-gray-400' : 'text-gray-600'}`}>
          {getDescription(badge)}
        </p>
        {hasProgress && <ProgressBar pct={badge.progress} />}
      </div>
    </li>
  )
}

// ── Export principal ──────────────────────────────────────────────────────────

const EXPLAIN_ENCART = (
  <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-gray-300 space-y-1">
    <p>🏅 <span className="font-medium text-white">Les badges</span> récompensent ta progression personnelle — ils dépendent uniquement de ta collection.</p>
    <p>🏆 <span className="font-medium text-white">Les trophées</span> sont remportés au sein de ta ligue — le premier à remplir la condition dans sa ligue remporte le trophée.</p>
  </div>
)

export default function BadgesClient({
  badges,
  sideLayout = false,
}: {
  badges: BadgeWithProgress[]
  sideLayout?: boolean
}) {
  const earned    = sortByStars(badges.filter((b) => b.earned))
  const notEarned = sortByStars(badges.filter((b) => !b.earned))

  const sectionEarned = (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-semibold text-white">🏅 Badges obtenus</h2>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#9ca3af' }}
        >
          {earned.length}
        </span>
      </div>
      {earned.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-gray-600">
          Aucun badge encore obtenu.
        </div>
      ) : (
        <ul className="space-y-3">
          {earned.map((b) => <EarnedCard key={b.badge_id} badge={b} />)}
        </ul>
      )}
    </section>
  )

  const sectionInProgress = (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-semibold text-white">⏳ En progression</h2>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#9ca3af' }}
        >
          {notEarned.length}
        </span>
      </div>
      {notEarned.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-gray-600">
          Tous les badges sont débloqués !
        </div>
      ) : (
        <ul className="space-y-3">
          {notEarned.map((b) => <NotEarnedCard key={b.badge_id} badge={b} />)}
        </ul>
      )}
    </section>
  )

  if (sideLayout) {
    return (
      <div className="space-y-6">
        {EXPLAIN_ENCART}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {sectionEarned}
          {sectionInProgress}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {EXPLAIN_ENCART}
      {sectionEarned}
      {sectionInProgress}
    </div>
  )
}
