'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { leaveLeague } from '@/app/actions/leagues'

export function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
    >
      {copied ? (
        <>
          <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Copié !
        </>
      ) : (
        <>
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
          Copier
        </>
      )}
    </button>
  )
}

export function LeaveButton({ leagueId }: { leagueId: string }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)

  function handleLeave() {
    if (!confirm) {
      setConfirm(true)
      return
    }
    setError('')
    startTransition(async () => {
      const result = await leaveLeague(leagueId)
      if ('error' in result) {
        setError(result.error)
        setConfirm(false)
      } else {
        router.push('/leagues')
      }
    })
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      <button
        type="button"
        onClick={handleLeave}
        disabled={pending}
        className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
          confirm
            ? 'border-red-500 bg-red-600/20 text-red-300 hover:bg-red-600/30'
            : 'border-white/20 text-gray-400 hover:border-red-500/50 hover:text-red-400'
        }`}
      >
        {pending ? 'Départ…' : confirm ? 'Confirmer le départ ?' : 'Quitter la ligue'}
      </button>
      {confirm && !pending && (
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="ml-2 text-xs text-gray-500 hover:text-gray-300"
        >
          Annuler
        </button>
      )}
    </div>
  )
}
