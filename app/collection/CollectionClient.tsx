'use client'

import { useState } from 'react'

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

// ── Mapping pays → continent ────────────────────────────────

const CONTINENT_MAP: Record<string, string> = {
  // Europe
  Albania: 'Europe', Andorra: 'Europe', Armenia: 'Europe', Austria: 'Europe',
  Azerbaijan: 'Europe', Belarus: 'Europe', Belgium: 'Europe',
  'Bosnia and Herzegovina': 'Europe', Bulgaria: 'Europe', Croatia: 'Europe',
  Cyprus: 'Europe', Czechia: 'Europe', 'Czech Republic': 'Europe',
  Denmark: 'Europe', England: 'Europe', Estonia: 'Europe',
  'Faroe Islands': 'Europe', Finland: 'Europe', France: 'Europe',
  Georgia: 'Europe', Germany: 'Europe', Gibraltar: 'Europe', Greece: 'Europe',
  Hungary: 'Europe', Iceland: 'Europe', Ireland: 'Europe', Israel: 'Europe',
  Italy: 'Europe', Kazakhstan: 'Europe', Kosovo: 'Europe', Latvia: 'Europe',
  Liechtenstein: 'Europe', Lithuania: 'Europe', Luxembourg: 'Europe',
  Malta: 'Europe', Moldova: 'Europe', Montenegro: 'Europe',
  Netherlands: 'Europe', 'North Macedonia': 'Europe',
  'Northern Ireland': 'Europe', Norway: 'Europe', Poland: 'Europe',
  Portugal: 'Europe', Romania: 'Europe', Russia: 'Europe',
  'San Marino': 'Europe', Scotland: 'Europe', Serbia: 'Europe',
  Slovakia: 'Europe', Slovenia: 'Europe', Spain: 'Europe', Sweden: 'Europe',
  Switzerland: 'Europe', 'Türkiye': 'Europe', Turkey: 'Europe',
  Ukraine: 'Europe', Wales: 'Europe',
  // Amérique
  Argentina: 'Amérique', Bolivia: 'Amérique', Brazil: 'Amérique',
  Canada: 'Amérique', Chile: 'Amérique', Colombia: 'Amérique',
  'Costa Rica': 'Amérique', Cuba: 'Amérique', 'Dominican Republic': 'Amérique',
  Ecuador: 'Amérique', 'El Salvador': 'Amérique', Guatemala: 'Amérique',
  Haiti: 'Amérique', Honduras: 'Amérique', Jamaica: 'Amérique',
  Mexico: 'Amérique', Nicaragua: 'Amérique', Panama: 'Amérique',
  Paraguay: 'Amérique', Peru: 'Amérique', 'Puerto Rico': 'Amérique',
  'Trinidad and Tobago': 'Amérique', USA: 'Amérique', Uruguay: 'Amérique',
  Venezuela: 'Amérique', Curaçao: 'Amérique',
  // Asie
  Afghanistan: 'Asie', Bahrain: 'Asie', Bangladesh: 'Asie', China: 'Asie',
  India: 'Asie', Indonesia: 'Asie', Iran: 'Asie', Iraq: 'Asie',
  Japan: 'Asie', Jordan: 'Asie', Kuwait: 'Asie', Lebanon: 'Asie',
  Malaysia: 'Asie', Myanmar: 'Asie', Nepal: 'Asie',
  'North Korea': 'Asie', Oman: 'Asie', Pakistan: 'Asie',
  Palestine: 'Asie', Philippines: 'Asie', Qatar: 'Asie',
  'Saudi Arabia': 'Asie', Singapore: 'Asie', 'South Korea': 'Asie',
  Syria: 'Asie', Taiwan: 'Asie', Tajikistan: 'Asie', Thailand: 'Asie',
  'United Arab Emirates': 'Asie', Uzbekistan: 'Asie', Vietnam: 'Asie',
  Yemen: 'Asie',
  // Afrique
  Algeria: 'Afrique', Angola: 'Afrique', Benin: 'Afrique',
  Burkina: 'Afrique', Cameroon: 'Afrique', 'Cape Verde': 'Afrique',
  'Congo DR': 'Afrique', Egypt: 'Afrique', Ethiopia: 'Afrique',
  Gabon: 'Afrique', Ghana: 'Afrique', Guinea: 'Afrique',
  'Ivory Coast': 'Afrique', Kenya: 'Afrique', Libya: 'Afrique',
  Madagascar: 'Afrique', Mali: 'Afrique', Mauritania: 'Afrique',
  Morocco: 'Afrique', Mozambique: 'Afrique', Namibia: 'Afrique',
  Nigeria: 'Afrique', Rwanda: 'Afrique', Senegal: 'Afrique',
  'Sierra Leone': 'Afrique', Somalia: 'Afrique', 'South Africa': 'Afrique',
  Sudan: 'Afrique', Tanzania: 'Afrique', Togo: 'Afrique',
  Tunisia: 'Afrique', Uganda: 'Afrique', Zambia: 'Afrique',
  Zimbabwe: 'Afrique',
  // Océanie
  Australia: 'Océanie', Fiji: 'Océanie', 'New Zealand': 'Océanie',
  'Papua New Guinea': 'Océanie', Samoa: 'Océanie', Tonga: 'Océanie',
  Vanuatu: 'Océanie',
}

export function getContinent(country: string): string {
  return CONTINENT_MAP[country] ?? 'Autre'
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
  const totalRef   = countries.reduce((s, c) => s + c.total, 0)
  const globalPct  = totalRef > 0 ? Math.round((totalOwned / totalRef) * 100) : 0

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
