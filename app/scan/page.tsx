'use client'

import { useActionState, useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { uploadPack } from '@/app/actions/scan'

type StickerResult = {
  sticker_id: string | null
  display_name: string | null
  confidence: number
  status: 'matched' | 'needs_review' | 'unmatched'
  is_duplicate: boolean
}

type Badge = {
  badge_id: string
  name: string
  points: number
}

type ScanResults = {
  stickers: StickerResult[]
  new_badges: Badge[]
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function ResultsModal({ results, onClose }: { results: ScanResults; onClose: () => void }) {
  const matched      = results.stickers.filter(s => s.status === 'matched')
  const unrecognised = results.stickers.filter(s => s.status === 'needs_review' || s.status === 'unmatched')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {matched.length} sticker{matched.length !== 1 ? 's' : ''} reconnu{matched.length !== 1 ? 's' : ''} !
          </h2>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-6 space-y-6">
          {/* Stickers matchés */}
          {matched.length > 0 && (
            <ul className="space-y-2">
              {matched.map((s, i) => (
                <li key={i} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span className="text-sm font-medium text-gray-800">{s.display_name}</span>
                  {s.is_duplicate && (
                    <span className="ml-2 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      doublon
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Non reconnus */}
          {unrecognised.length > 0 && (
            <div className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-500">
              {unrecognised.length} sticker{unrecognised.length !== 1 ? 's' : ''} non reconnu{unrecognised.length !== 1 ? 's' : ''}
            </div>
          )}

          {/* Nouveaux badges */}
          {results.new_badges.length > 0 && (
            <div>
              <p className="mb-3 font-semibold text-gray-900">🏅 Badges débloqués !</p>
              <ul className="space-y-2">
                {results.new_badges.map((b) => (
                  <li key={b.badge_id} className="flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3">
                    <span className="text-sm font-medium text-indigo-900">{b.name}</span>
                    <span className="text-sm font-semibold text-indigo-600">+{b.points} pts</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            Scanner un autre blister
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ScanPage() {
  const [state, action, pending] = useActionState(uploadPack, {})
  const [preview, setPreview]   = useState<string | null>(null)
  const [hasFile, setHasFile]   = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [results, setResults]   = useState<ScanResults | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef  = useRef<HTMLFormElement>(null)

  // Dès que l'upload réussit, appeler /api/process-scan côté client
  useEffect(() => {
    if (!state.pack_id || !state.user_id) return

    setPreview(null)
    setHasFile(false)
    formRef.current?.reset()
    setAnalyzing(true)
    setAnalyzeError(null)

    fetch('/api/process-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pack_id: state.pack_id, user_id: state.user_id }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? `HTTP ${res.status}`)
        }
        return res.json() as Promise<ScanResults>
      })
      .then((data) => {
        setResults(data)
      })
      .catch((err: Error) => {
        setAnalyzeError(err.message)
      })
      .finally(() => {
        setAnalyzing(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pack_id, state.user_id])

  function handleReset() {
    setPreview(null)
    setHasFile(false)
    setResults(null)
    setAnalyzeError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <main className="mx-auto max-w-lg px-4 sm:px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Scanner un blister</h1>
        <p className="mt-1 text-sm text-gray-500">
          Prends en photo ton blister Panini pour l&apos;analyser.
        </p>
      </div>

      {/* État : analyse en cours */}
      {analyzing && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-indigo-100 bg-indigo-50 py-16 text-center">
          <Spinner />
          <p className="text-sm font-medium text-indigo-700">🔍 Analyse en cours…</p>
          <p className="text-xs text-indigo-400">Reconnaissance des stickers par IA</p>
        </div>
      )}

      {/* Erreur d'analyse */}
      {analyzeError && !analyzing && (
        <div className="space-y-4">
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            Erreur d&apos;analyse : {analyzeError}
          </div>
          <button
            onClick={handleReset}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Formulaire (masqué pendant l'analyse) */}
      {!analyzing && !analyzeError && !results && (
        <form ref={formRef} action={action} className="space-y-6">
          {state.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          <input
            ref={inputRef}
            id="photo"
            name="photo"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setHasFile(true)
              setPreview(URL.createObjectURL(file))
            }}
          />

          {!preview ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 bg-white px-6 py-16 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
                <svg className="h-7 w-7 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Scanner mon blister</p>
                <p className="mt-0.5 text-xs text-gray-400">Caméra sur mobile · Galerie sur desktop</p>
              </div>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <Image
                  src={preview}
                  alt="Aperçu du blister"
                  width={600}
                  height={400}
                  className="h-72 w-full object-contain"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={handleReset}
                  className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 shadow hover:bg-white transition-colors"
                  aria-label="Changer la photo"
                >
                  <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={pending}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Changer
                </button>
                <button
                  type="submit"
                  disabled={pending || !hasFile}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {pending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner />
                      Envoi…
                    </span>
                  ) : 'Envoyer'}
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {/* Modale de résultats */}
      {results && <ResultsModal results={results} onClose={handleReset} />}
    </main>
  )
}
