'use client'

import { useState } from 'react'
import { getContinent } from '@/lib/continents'
import { TOTAL_STICKERS } from '@/lib/stats'

export type StickerItem = {
  sticker_id: string
  display_name: string
  owned: boolean
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

// ── Composant accordion pays ─────────────────────────────────

function CountryRow({ data }: { data: CountryData }) {
  const [open, setOpen] = useState(false)

  const pctColor =
    data.pct === 100
      ? 'bg-yellow-400'
      : data.pct >= 50
      ? 'bg-red-500'
      : 'bg-white/30'

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/5 transition-colors"
      >
        {/* Pays + progression */}
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
        {/* % + chevron */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-gray-400 tabular-nums w-10 text-right">
            {data.pct}%
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
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {data.stickers.map((s) => (
              <li
                key={s.sticker_id}
                className={`text-sm truncate ${
                  s.owned ? 'text-white' : 'text-gray-600'
                }`}
              >
                {s.owned ? '✓ ' : '○ '}{s.display_name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Composant principal client ───────────────────────────────

export default function CollectionClient({ countries }: { countries: CountryData[] }) {
  const [activeContinent, setActiveContinent] = useState('Tous')

  const filtered = activeContinent === 'Tous'
    ? countries
    : countries.filter((c) => c.continent === activeContinent)

  const totalOwned = countries.reduce((s, c) => s + c.ownedCount, 0)
  const totalRef   = TOTAL_STICKERS
  const globalPct  = parseFloat(((totalOwned / TOTAL_STICKERS) * 100).toFixed(1))

  return (
    <div className="space-y-6">
      {/* Stats globales */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-gray-400">Collection globale</p>
          <p className="text-2xl font-bold text-white">
            {totalOwned}
            <span className="text-sm font-normal text-gray-400 ml-1">/ {totalRef} stickers</span>
          </p>
        </div>
        <div className="flex-1 max-w-xs">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Progression</span>
            <span style={{ color: '#ffd60a' }}>{globalPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-red-500 transition-all duration-700"
              style={{ width: `${globalPct}%` }}
            />
          </div>
        </div>
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
            style={activeContinent === c ? { backgroundColor: '#dc2626' } : {}}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Liste des pays */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">
            Aucun pays pour ce continent.
          </p>
        ) : (
          filtered.map((country) => (
            <CountryRow key={country.country} data={country} />
          ))
        )}
      </div>
    </div>
  )
}
