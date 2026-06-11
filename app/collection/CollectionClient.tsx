'use client'

import { useState, useCallback, useRef } from 'react'
import { addSticker, removeSticker } from '@/app/actions/collection'

export type StickerItem = {
  sticker_id: string
  display_name: string
  owned: boolean
  quantity: number
}

export type CountryData = {
  country: string
  continent: string
  total: number
  ownedCount: number
  pct: number
  stickers: StickerItem[]
}

export type BadgeSectionData = {
  title: string
  items: (StickerItem & { country: string })[]
  ownedCount: number
}

const CONTINENTS = ['Tous', 'Europe', 'Amérique', 'Asie', 'Afrique', 'Océanie']

type SortBy = 'pct' | 'alpha'

// ── Toast ─────────────────────────────────────────────────────────────────────

type Toast = { id: number; message: string }

function ToastList({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded-xl bg-yellow-400 px-5 py-3 text-sm font-semibold text-gray-900 shadow-lg"
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ── Contrôles sticker (−  [n]  +) ─────────────────────────────────────────────

function StickerControls({
  stickerId,
  owned,
  onAdd,
  onRemove,
}: {
  stickerId: string
  owned: boolean
  onAdd: (id: string, qty: number) => Promise<void>
  onRemove: (id: string) => Promise<void>
}) {
  const [qty, setQty] = useState(1)
  const [addFlash, setAddFlash] = useState(false)
  const [removeFlash, setRemoveFlash] = useState(false)
  const [loading, setLoading] = useState<'add' | 'remove' | null>(null)

  async function handleAdd(e: React.MouseEvent) {
    e.stopPropagation()
    if (loading) return
    setLoading('add')
    await onAdd(stickerId, qty)
    setLoading(null)
    setAddFlash(true)
    setTimeout(() => setAddFlash(false), 1200)
  }

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation()
    if (loading || !owned) return
    setLoading('remove')
    await onRemove(stickerId)
    setLoading(null)
    setRemoveFlash(true)
    setTimeout(() => setRemoveFlash(false), 1200)
  }

  return (
    <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {/* Flash messages */}
      {removeFlash && <span className="text-xs text-red-400 w-14 text-right">✓ Retiré</span>}
      {addFlash && !removeFlash && <span className="text-xs text-green-400 w-14 text-right">✓ Ajouté !</span>}

      {/* Bouton − */}
      <button
        onClick={handleRemove}
        disabled={!owned || loading !== null}
        title="Retirer de ma collection"
        className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15 text-red-400 text-sm font-bold hover:bg-red-500/30 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
      >
        −
      </button>

      {/* Input quantité */}
      <input
        type="number"
        min={1}
        max={99}
        value={qty}
        onChange={(e) => setQty(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
        className="w-8 rounded bg-white/10 text-center text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500/50 py-0.5 tabular-nums"
      />

      {/* Bouton + */}
      <button
        onClick={handleAdd}
        disabled={loading !== null}
        title={owned ? 'Ajouter un doublon' : 'Ajouter à ma collection'}
        className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold transition-colors disabled:opacity-40 ${
          owned
            ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/40'
            : 'bg-green-500/20 text-green-400 hover:bg-green-500/40'
        }`}
      >
        +
      </button>
    </div>
  )
}

// ── Section emblèmes / team photos ───────────────────────────────────────────

function BadgeSection({
  section,
  onAdd,
  onRemove,
  isGuest,
}: {
  section: BadgeSectionData
  onAdd: (id: string, qty: number) => Promise<void>
  onRemove: (id: string) => Promise<void>
  isGuest: boolean
}) {
  const [open, setOpen] = useState(false)
  const total = section.items.length

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-white truncate">{section.title}</span>
            <span className="ml-3 shrink-0 text-sm font-medium" style={{ color: '#ffd60a' }}>
              {section.ownedCount}/{total}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-500 bg-white/30"
              style={{ width: `${total > 0 ? Math.round((section.ownedCount / total) * 100) : 0}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-gray-400 tabular-nums w-10 text-right">
            {total > 0 ? Math.round((section.ownedCount / total) * 100) : 0}%
          </span>
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-white/10 px-5 py-3 bg-black/20">
          <ul className="space-y-1">
            {section.items.map((s) => (
              <li key={s.sticker_id} className="flex items-center justify-between gap-2 py-0.5">
                <span className={`text-sm truncate flex-1 ${s.owned ? 'text-white' : 'text-gray-600'}`}>
                  {s.owned ? '✓ ' : '○ '}
                  <span className="text-gray-400 text-xs mr-1">{s.country}</span>
                  {s.display_name}
                  {s.owned && (
                    <span className="ml-1.5 text-xs text-amber-500">×{s.quantity}</span>
                  )}
                </span>
                {!isGuest && (
                  <StickerControls
                    stickerId={s.sticker_id}
                    owned={s.owned}
                    onAdd={onAdd}
                    onRemove={onRemove}
                  />
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-600 italic">
            Ces stickers ne sont pas reconnus par le scanner — ajout manuel uniquement.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Accordion pays ────────────────────────────────────────────────────────────

function CountryRow({
  data,
  forceOpen,
  searchQuery,
  onAdd,
  onRemove,
  isGuest,
}: {
  data: CountryData
  forceOpen: boolean
  searchQuery: string
  onAdd: (id: string, qty: number) => Promise<void>
  onRemove: (id: string) => Promise<void>
  isGuest: boolean
}) {
  const [localOpen, setLocalOpen] = useState(false)
  const isOpen = forceOpen || localOpen

  const visibleStickers = searchQuery
    ? data.stickers.filter((s) =>
        s.display_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : data.stickers

  const pctColor =
    data.pct === 100 ? 'bg-yellow-400' : data.pct >= 50 ? 'bg-orange-500' : 'bg-white/30'

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setLocalOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-white truncate">{data.country}</span>
            <span className="ml-3 shrink-0 text-sm font-medium" style={{ color: '#ffd60a' }}>
              {data.ownedCount}/{data.total}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pctColor}`}
              style={{ width: `${data.pct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-gray-400 tabular-nums w-10 text-right">{data.pct}%</span>
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-white/10 px-5 py-3 bg-black/20">
          <ul className="space-y-1">
            {visibleStickers.map((s) => (
              <li key={s.sticker_id} className="flex items-center justify-between gap-2 py-0.5">
                <span className={`text-sm truncate flex-1 ${s.owned ? 'text-white' : 'text-gray-600'}`}>
                  {s.owned ? '✓ ' : '○ '}{s.display_name}
                  {s.owned && (
                    <span className="ml-1.5 text-xs text-amber-500">×{s.quantity}</span>
                  )}
                </span>
                {!isGuest && (
                  <StickerControls
                    stickerId={s.sticker_id}
                    owned={s.owned}
                    onAdd={onAdd}
                    onRemove={onRemove}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function CollectionClient({
  countries: initialCountries,
  emblemSection: initialEmblemSection,
  teamPhotoSection: initialTeamPhotoSection,
  isGuest = false,
}: {
  countries: CountryData[]
  emblemSection: BadgeSectionData
  teamPhotoSection: BadgeSectionData
  isGuest?: boolean
}) {
  const [countries, setCountries] = useState<CountryData[]>(initialCountries)
  const [emblemSection, setEmblemSection] = useState<BadgeSectionData>(initialEmblemSection)
  const [teamPhotoSection, setTeamPhotoSection] = useState<BadgeSectionData>(initialTeamPhotoSection)
  const [activeContinent, setActiveContinent] = useState('Tous')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('pct')
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastIdRef = useRef(0)

  function addToast(message: string) {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  // ── Mise à jour optimiste de la quantité d'un sticker ──────────────────────
  function applyDelta(stickerId: string, delta: number) {
    // Joueurs
    setCountries((prev) =>
      prev.map((country) => {
        const idx = country.stickers.findIndex((s) => s.sticker_id === stickerId)
        if (idx === -1) return country
        const stickers = country.stickers.map((s, i) => {
          if (i !== idx) return s
          const newQty = Math.max(0, s.quantity + delta)
          return { ...s, quantity: newQty, owned: newQty > 0 }
        })
        const ownedCount = stickers.filter((s) => s.owned).length
        const pct = country.total > 0 ? Math.round((ownedCount / country.total) * 100) : 0
        return { ...country, stickers, ownedCount, pct }
      })
    )
    // Emblèmes
    setEmblemSection((prev) => {
      const idx = prev.items.findIndex((s) => s.sticker_id === stickerId)
      if (idx === -1) return prev
      const items = prev.items.map((s, i) => {
        if (i !== idx) return s
        const newQty = Math.max(0, s.quantity + delta)
        return { ...s, quantity: newQty, owned: newQty > 0 }
      })
      return { ...prev, items, ownedCount: items.filter((s) => s.owned).length }
    })
    // Team photos
    setTeamPhotoSection((prev) => {
      const idx = prev.items.findIndex((s) => s.sticker_id === stickerId)
      if (idx === -1) return prev
      const items = prev.items.map((s, i) => {
        if (i !== idx) return s
        const newQty = Math.max(0, s.quantity + delta)
        return { ...s, quantity: newQty, owned: newQty > 0 }
      })
      return { ...prev, items, ownedCount: items.filter((s) => s.owned).length }
    })
  }

  const handleAdd = useCallback(async (stickerId: string, qty: number) => {
    applyDelta(stickerId, qty)
    const result = await addSticker(stickerId, qty)
    if ('error' in result) {
      applyDelta(stickerId, -qty)           // rollback
      addToast(`❌ Erreur : ${result.error}`)
      return
    }
    for (const b of result.new_badges)  addToast(`🏅 Nouveau badge : ${b.name} !`)
    for (const t of result.new_trophies) addToast(`🏆 Nouveau trophée : ${t.name} !`)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemove = useCallback(async (stickerId: string) => {
    applyDelta(stickerId, -1)
    const result = await removeSticker(stickerId)
    if ('error' in result) {
      applyDelta(stickerId, 1)              // rollback
      addToast(`❌ Erreur : ${result.error}`)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtrage + tri ─────────────────────────────────────────────────────────
  const isSearching = searchQuery.trim().length > 0

  const filteredCountries = countries
    .filter((c) => activeContinent === 'Tous' || c.continent === activeContinent)
    .filter((c) => {
      if (!isSearching) return true
      return c.stickers.some((s) =>
        s.display_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })
    .slice()
    .sort((a, b) => {
      if (sortBy === 'alpha') return a.country.localeCompare(b.country, 'fr')
      // pct décroissant, puis alpha
      if (b.pct !== a.pct) return b.pct - a.pct
      return a.country.localeCompare(b.country, 'fr')
    })

  return (
    <div className="space-y-5">
      {/* Bannière invité */}
      {isGuest && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-5 py-4">
          <p className="text-sm text-orange-200">
            👋 Tu vois ici tous les stickers de la Coupe du Monde 2026. Crée ton compte pour suivre ta vraie collection !
          </p>
          <a
            href="/register"
            className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#f97316' }}
          >
            S&apos;inscrire
          </a>
        </div>
      )}

      {/* Barre de recherche */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none"
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
        </svg>
        <input
          type="text"
          placeholder="Rechercher un joueur…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-9 text-sm text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Tri + filtres continent (masqués pendant la recherche) */}
      {!isSearching && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Toggle tri */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs font-medium">
            <button
              type="button"
              onClick={() => setSortBy('pct')}
              className={`px-3 py-1.5 transition-colors ${
                sortBy === 'pct' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              % complétion
            </button>
            <button
              type="button"
              onClick={() => setSortBy('alpha')}
              className={`px-3 py-1.5 border-l border-white/10 transition-colors ${
                sortBy === 'alpha' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              A → Z
            </button>
          </div>

          {/* Filtres continent */}
          <div className="flex flex-wrap gap-2">
            {CONTINENTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveContinent(c)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeContinent === c
                    ? 'text-white'
                    : 'border border-white/15 text-gray-400 hover:border-white/30 hover:text-white'
                }`}
                style={activeContinent === c ? { backgroundColor: '#f97316' } : {}}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Liste des pays */}
      <div className="space-y-2">
        {filteredCountries.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">
            {isSearching ? 'Aucun joueur trouvé.' : 'Aucun pays pour ce continent.'}
          </p>
        ) : (
          filteredCountries.map((country) => (
            <CountryRow
              key={country.country}
              data={country}
              forceOpen={isSearching}
              searchQuery={searchQuery}
              onAdd={handleAdd}
              onRemove={handleRemove}
              isGuest={isGuest}
            />
          ))
        )}
      </div>

      {/* ── Sections badges (emblèmes + team photos) ── */}
      {!isSearching && (
        <div className="space-y-2 pt-2 border-t border-white/10">
          <p className="text-xs text-gray-500 pb-1">Stickers non scannables — ajout manuel uniquement</p>
          <BadgeSection section={emblemSection} onAdd={handleAdd} onRemove={handleRemove} isGuest={isGuest} />
          <BadgeSection section={teamPhotoSection} onAdd={handleAdd} onRemove={handleRemove} isGuest={isGuest} />
        </div>
      )}

      <ToastList toasts={toasts} />
    </div>
  )
}
