'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { addSticker } from '@/app/actions/collection'
import type { NewBadge, NewTrophy } from '@/lib/checkBadges'

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

const CONTINENTS = ['Tous', 'Europe', 'Amérique', 'Asie', 'Afrique', 'Océanie']

// ── Toast ─────────────────────────────────────────────────────────────────────

type Toast = { id: number; message: string }

function ToastList({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded-xl bg-yellow-400 px-5 py-3 text-sm font-semibold text-gray-900 shadow-lg animate-fade-in"
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ── Bouton + ─────────────────────────────────────────────────────────────────

function AddButton({
  stickerId,
  owned,
  onAdd,
}: {
  stickerId: string
  owned: boolean
  onAdd: (id: string) => void
}) {
  const [flash, setFlash] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    await onAdd(stickerId)
    setLoading(false)
    setFlash(true)
    setTimeout(() => setFlash(false), 1500)
  }

  if (flash) {
    return <span className="shrink-0 text-xs font-medium text-green-400">✓ Ajouté !</span>
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={owned ? 'Ajouter un doublon' : 'Ajouter à ma collection'}
      className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold transition-colors disabled:opacity-40 ${
        owned
          ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/40'
          : 'bg-green-500/20 text-green-400 hover:bg-green-500/40'
      }`}
    >
      +
    </button>
  )
}

// ── Accordion pays ────────────────────────────────────────────────────────────

function CountryRow({
  data,
  forceOpen,
  searchQuery,
  onAdd,
}: {
  data: CountryData
  forceOpen: boolean
  searchQuery: string
  onAdd: (id: string) => void
}) {
  const [localOpen, setLocalOpen] = useState(false)
  const isOpen = forceOpen || localOpen

  // Filtrer les stickers selon la recherche
  const visibleStickers = searchQuery
    ? data.stickers.filter((s) =>
        s.display_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : data.stickers

  const pctColor =
    data.pct === 100
      ? 'bg-yellow-400'
      : data.pct >= 50
      ? 'bg-orange-500'
      : 'bg-white/30'

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
          <span className="text-sm text-gray-400 tabular-nums w-10 text-right">
            {data.pct}%
          </span>
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
              <li
                key={s.sticker_id}
                className="flex items-center justify-between gap-2 py-0.5"
              >
                <span className={`text-sm truncate flex-1 ${s.owned ? 'text-white' : 'text-gray-600'}`}>
                  {s.owned ? '✓ ' : '○ '}{s.display_name}
                  {s.quantity > 1 && (
                    <span className="ml-1.5 text-xs text-amber-500">×{s.quantity}</span>
                  )}
                </span>
                <AddButton stickerId={s.sticker_id} owned={s.owned} onAdd={onAdd} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function CollectionClient({ countries: initialCountries }: { countries: CountryData[] }) {
  const [countries, setCountries] = useState<CountryData[]>(initialCountries)
  const [activeContinent, setActiveContinent] = useState('Tous')
  const [searchQuery, setSearchQuery] = useState('')
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastIdRef = useRef(0)

  function addToast(message: string) {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  const handleAdd = useCallback(async (stickerId: string) => {
    // Optimistic update
    setCountries((prev) =>
      prev.map((country) => {
        const idx = country.stickers.findIndex((s) => s.sticker_id === stickerId)
        if (idx === -1) return country

        const stickers = country.stickers.map((s, i) =>
          i === idx
            ? { ...s, owned: true, quantity: s.quantity + 1 }
            : s
        )
        const ownedCount = stickers.filter((s) => s.owned).length
        const pct = country.total > 0 ? Math.round((ownedCount / country.total) * 100) : 0
        return { ...country, stickers, ownedCount, pct }
      })
    )

    const result = await addSticker(stickerId)

    if ('error' in result) {
      // Rollback
      setCountries((prev) =>
        prev.map((country) => {
          const idx = country.stickers.findIndex((s) => s.sticker_id === stickerId)
          if (idx === -1) return country
          const wasOwned = country.stickers[idx].quantity > 1
          const stickers = country.stickers.map((s, i) =>
            i === idx
              ? { ...s, owned: wasOwned, quantity: Math.max(0, s.quantity - 1) }
              : s
          )
          const ownedCount = stickers.filter((s) => s.owned).length
          const pct = country.total > 0 ? Math.round((ownedCount / country.total) * 100) : 0
          return { ...country, stickers, ownedCount, pct }
        })
      )
      addToast(`❌ Erreur : ${result.error}`)
      return
    }

    // Toasts badges / trophées
    for (const b of result.new_badges) {
      addToast(`🏅 Nouveau badge : ${b.name} !`)
    }
    for (const t of result.new_trophies) {
      addToast(`🏆 Nouveau trophée : ${t.name} !`)
    }
  }, [])

  // Filtrage continent + recherche
  const filteredCountries = countries
    .filter((c) => activeContinent === 'Tous' || c.continent === activeContinent)
    .filter((c) => {
      if (!searchQuery) return true
      return c.stickers.some((s) =>
        s.display_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })

  const isSearching = searchQuery.trim().length > 0

  return (
    <div className="space-y-6">
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
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
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

      {/* Filtres continent */}
      {!isSearching && (
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
            />
          ))
        )}
      </div>

      <ToastList toasts={toasts} />
    </div>
  )
}
