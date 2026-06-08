'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createLeague, joinLeague } from '@/app/actions/leagues'

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#64748b' }}>
      Code&nbsp;:&nbsp;
      <span className="font-mono font-semibold tracking-wide text-gray-300">{code}</span>
      <button
        onClick={handleCopy}
        title="Copier le code"
        className="ml-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors hover:bg-white/10"
        style={{ color: copied ? '#4ade80' : '#64748b' }}
      >
        {copied ? 'Copié !' : '📋'}
      </button>
    </span>
  )
}

export default function LeaguesClient() {
  const router = useRouter()

  // ── Créer une ligue ─────────────────────────────────────────
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState('')
  const [createPending, startCreate] = useTransition()

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    startCreate(async () => {
      const result = await createLeague(createName)
      if ('error' in result) {
        setCreateError(result.error)
      } else {
        router.push(`/leagues/${result.league_id}`)
      }
    })
  }

  // ── Rejoindre une ligue ─────────────────────────────────────
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joinPending, startJoin] = useTransition()

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setJoinError('')
    startJoin(async () => {
      const result = await joinLeague(joinCode)
      if ('error' in result) {
        setJoinError(result.error)
      } else {
        router.push(`/leagues/${result.league_id}`)
      }
    })
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* ── Créer ── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-base font-bold text-white">Créer une ligue</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          {createError && (
            <p className="rounded-lg bg-red-900/40 border border-red-700/50 px-3 py-2 text-sm text-red-300">
              {createError}
            </p>
          )}
          <input
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Nom de la ligue"
            required
            minLength={2}
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <button
            type="submit"
            disabled={createPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#f97316' }}
          >
            {createPending ? <><Spinner /> Création…</> : 'Créer'}
          </button>
        </form>
      </div>

      {/* ── Rejoindre ── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-base font-bold text-white">Rejoindre une ligue</h2>
        <form onSubmit={handleJoin} className="space-y-3">
          {joinError && (
            <p className="rounded-lg bg-red-900/40 border border-red-700/50 px-3 py-2 text-sm text-red-300">
              {joinError}
            </p>
          )}
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Code d'invitation"
            required
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
          />
          <button
            type="submit"
            disabled={joinPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-colors hover:bg-white/10"
          >
            {joinPending ? <><Spinner /> Rejoindre…</> : 'Rejoindre'}
          </button>
        </form>
      </div>
    </div>
  )
}
