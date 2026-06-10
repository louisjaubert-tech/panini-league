'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { uploadPack } from '@/app/actions/scan'

// ── Dictionnaire étoiles (copie de BadgesClient.tsx) ─────────────────────────

const BADGE_META: Record<string, { stars: number }> = {
  b01: { stars: 1 },
  b02: { stars: 3 },
  b04: { stars: 2 },
  b05: { stars: 1 },
  b06: { stars: 2 },
  b08: { stars: 3 },
  b09: { stars: 3 },
  b10: { stars: 2 },
}

function getBadgeStars(badge_id: string): number {
  return BADGE_META[badge_id]?.stars ?? 2
}

function InlineStars({ badge_id }: { badge_id: string }) {
  const n = getBadgeStars(badge_id)
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3].map((i) => (
        <svg key={i} className="h-3 w-3" viewBox="0 0 20 20"
          fill={i <= n ? '#ffd60a' : 'none'}
          stroke={i <= n ? '#ffd60a' : '#4b5563'}
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
          />
        </svg>
      ))}
    </span>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

type StickerResult = {
  sticker_id: string | null
  display_name: string | null
  confidence: number
  status: 'matched' | 'needs_review' | 'unmatched'
  is_duplicate: boolean
}

type Badge  = { badge_id: string; name: string; points?: number }
type Trophy = { trophy_id: string; name: string }

// scan-process retourne maintenant juste { pack_id, stickers }
type ScanResult = { pack_id: string; stickers: StickerResult[] }

type PhotoStatus = {
  index: number
  name: string
  phase: 'waiting' | 'uploading' | 'analyzing' | 'done' | 'failed'
  error?: string
  stickerCount?: number
}

type AccumulatedResults = {
  stickers: StickerResult[]
  packIds: string[]        // un par photo réussie — utilisés pour confirm/cancel
  userId: string
  failedCount: number
  successCount: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Spinner({ size = 5 }: { size?: number }) {
  return (
    <svg className={`h-${size} w-${size} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function phaseIcon(phase: PhotoStatus['phase']) {
  if (phase === 'done')    return <span className="text-green-400">✓</span>
  if (phase === 'failed')  return <span className="text-red-400">⚠️</span>
  if (phase === 'waiting') return <span className="text-gray-600">○</span>
  return <Spinner size={3} />
}

/** Tri alphabétique par nom de famille (dernier mot du display_name) */
function sortByLastName(stickers: StickerResult[]): StickerResult[] {
  return [...stickers].sort((a, b) => {
    const lastName = (s: StickerResult) =>
      (s.display_name ?? '').split(' ').pop()?.toLowerCase() ?? ''
    return lastName(a).localeCompare(lastName(b), 'fr')
  })
}

// ── Modale résultats ──────────────────────────────────────────────────────────

type ModalPhase = 'review' | 'confirming' | 'cancelling' | 'confirmed'

function ResultsModal({
  results,
  onDone,
}: {
  results: AccumulatedResults
  onDone: () => void
}) {
  const [phase, setPhase]           = useState<ModalPhase>('review')
  const [newBadges, setNewBadges]   = useState<Badge[]>([])
  const [newTrophies, setNewTrophies] = useState<Trophy[]>([])
  const [confirmedCount, setConfirmedCount] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [retractPhase, setRetractPhase] = useState<'idle' | 'loading' | 'done'>('idle')

  const matched      = sortByLastName(results.stickers.filter(s => s.sticker_id !== null))
  const unrecognised = results.stickers.filter(s => s.sticker_id === null)

  async function handleConfirm() {
    setPhase('confirming')
    setActionError(null)

    // Confirmer tous les packs en séquence
    const allBadges: Badge[] = []
    const allTrophies: Trophy[] = []
    let totalAdded = 0

    for (const packId of results.packIds) {
      try {
        const res = await fetch('/api/confirm-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pack_id: packId, user_id: results.userId }),
        })
        const data = await res.json()
        if (typeof data.stickers_added === 'number') totalAdded += data.stickers_added
        if (data.new_badges)  allBadges.push(...data.new_badges)
        if (data.new_trophies) allTrophies.push(...data.new_trophies)
      } catch (err) {
        console.error('[confirm-scan]', err)
      }
    }
    setConfirmedCount(totalAdded)

    // Dédupliquer
    const seenB = new Set<string>()
    const seenT = new Set<string>()
    const dedupedBadges  = allBadges.filter(b => seenB.has(b.badge_id) ? false : (seenB.add(b.badge_id), true))
    const dedupedTrophies = allTrophies.filter(t => seenT.has(t.trophy_id) ? false : (seenT.add(t.trophy_id), true))

    setNewBadges(dedupedBadges)
    setNewTrophies(dedupedTrophies)
    setPhase('confirmed')
  }

  async function handleRetract() {
    setRetractPhase('loading')
    setActionError(null)
    for (const packId of results.packIds) {
      try {
        const res = await fetch('/api/cancel-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pack_id: packId, user_id: results.userId }),
        })
        const data = await res.json()
        if (!res.ok || data.error) {
          setActionError(data.error ?? 'Erreur lors de l\'annulation.')
          setRetractPhase('idle')
          return
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erreur réseau.')
        setRetractPhase('idle')
        return
      }
    }
    setRetractPhase('done')
  }

  async function handleCancel() {
    setPhase('cancelling')
    for (const packId of results.packIds) {
      try {
        await fetch('/api/cancel-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pack_id: packId }),
        })
      } catch (err) {
        console.error('[cancel-scan]', err)
      }
    }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1e35] shadow-xl">

        {/* ── En-tête ── */}
        <div className="p-6 border-b border-white/10">
          {phase === 'confirmed' ? (
            <>
              <h2 className="text-xl font-bold text-white">
                {(confirmedCount ?? matched.length)} sticker{(confirmedCount ?? matched.length) !== 1 ? 's' : ''} ajouté{(confirmedCount ?? matched.length) !== 1 ? 's' : ''} ! ✅
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Ta collection a été mise à jour.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white">
                {matched.length} sticker{matched.length !== 1 ? 's' : ''} reconnu{matched.length !== 1 ? 's' : ''} !
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Sur {results.successCount} photo{results.successCount !== 1 ? 's' : ''} analysée{results.successCount !== 1 ? 's' : ''}
                {results.failedCount > 0 && (
                  <span className="ml-1 text-red-400">· {results.failedCount} échouée{results.failedCount > 1 ? 's' : ''}</span>
                )}
              </p>
            </>
          )}
        </div>

        {/* ── Corps ── */}
        <div className="max-h-[50vh] overflow-y-auto p-6 space-y-6">

          {/* Avant confirmation : liste stickers + non reconnus */}
          {phase !== 'confirmed' && (
            <>
              {matched.length > 0 && (
                <ul className="space-y-2">
                  {matched.map((s, i) => (
                    <li key={i} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2.5">
                      <span className="text-sm font-medium text-white">{s.display_name}</span>
                      {s.is_duplicate && (
                        <span className="ml-2 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          doublon
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {unrecognised.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-400">
                  {unrecognised.length} sticker{unrecognised.length !== 1 ? 's' : ''} non reconnu{unrecognised.length !== 1 ? 's' : ''}
                </div>
              )}
            </>
          )}

          {/* Badges/trophées (phase confirmée uniquement) */}
          {phase === 'confirmed' && newBadges.length > 0 && (
            <div>
              <p className="mb-3 font-semibold text-white">🏅 Badges débloqués !</p>
              <ul className="space-y-2">
                {newBadges.map((b) => (
                  <li key={b.badge_id} className="flex items-center justify-between rounded-xl bg-yellow-400/10 px-4 py-3">
                    <span className="text-sm font-medium text-white">{b.name}</span>
                    <InlineStars badge_id={b.badge_id} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {phase === 'confirmed' && newTrophies.length > 0 && (
            <div>
              <p className="mb-3 font-semibold text-white">🏆 Trophées débloqués !</p>
              <ul className="space-y-2">
                {newTrophies.map((t) => (
                  <li key={t.trophy_id} className="rounded-xl bg-yellow-400/10 px-4 py-3 text-sm font-medium text-white">
                    {t.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {actionError && (
            <p className="rounded-lg bg-red-900/40 border border-red-700/50 px-3 py-2 text-sm text-red-300">
              {actionError}
            </p>
          )}
        </div>

        {/* ── Footer avec boutons ── */}
        <div className="p-6 border-t border-white/10 space-y-2">
          {phase === 'review' && (
            <>
              <button
                onClick={handleConfirm}
                className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition-colors"
              >
                ✅ Confirmer — ajouter {matched.length} sticker{matched.length !== 1 ? 's' : ''} à ma collection
              </button>
              <button
                onClick={handleCancel}
                className="w-full rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors"
              >
                ❌ Annuler
              </button>
            </>
          )}

          {(phase === 'confirming' || phase === 'cancelling') && (
            <div className="flex items-center justify-center gap-3 py-2 text-sm text-gray-400">
              <Spinner size={4} />
              {phase === 'confirming' ? 'Enregistrement en cours…' : 'Annulation en cours…'}
            </div>
          )}

          {phase === 'confirmed' && (
            <>
              {retractPhase === 'done' ? (
                <>
                  <p className="text-center text-sm text-green-400 py-1">
                    ✅ Scan annulé — stickers retirés de ta collection
                  </p>
                  <button
                    onClick={onDone}
                    className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 transition-colors"
                  >
                    Scanner d&apos;autres stickers
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onDone}
                    className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 transition-colors"
                  >
                    Scanner d&apos;autres stickers
                  </button>
                  <button
                    onClick={handleRetract}
                    disabled={retractPhase === 'loading'}
                    className="w-full rounded-lg border border-white/15 px-4 py-2 text-xs font-medium text-gray-400 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {retractPhase === 'loading' ? 'Annulation en cours…' : '↩️ Annuler ce ScanPhoto et retirer les stickers ajoutés'}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function ScanClient() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Sélection
  const [files, setFiles]     = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])

  // Traitement
  const [processing, setProcessing]   = useState(false)
  const [photoStatuses, setPhotoStatuses] = useState<PhotoStatus[]>([])
  const [currentIdx, setCurrentIdx]   = useState(0)

  // Résultats (en attente de confirmation)
  const [results, setResults]       = useState<AccumulatedResults | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const MAX_PHOTOS = 5

  function handleFilesSelected(selected: FileList | null) {
    if (!selected || selected.length === 0) return
    let arr = Array.from(selected)
    if (arr.length > MAX_PHOTOS) {
      setUploadError(`⚠️ Maximum ${MAX_PHOTOS} photos à la fois. Tu as sélectionné ${arr.length} photos — seules les ${MAX_PHOTOS} premières seront analysées.`)
      arr = arr.slice(0, MAX_PHOTOS)
    } else {
      setUploadError(null)
    }
    setFiles(arr)
    setPreviews(arr.map((f) => URL.createObjectURL(f)))
    setResults(null)
    setPhotoStatuses([])
  }

  function handleReset() {
    previews.forEach((url) => URL.revokeObjectURL(url))
    setFiles([])
    setPreviews([])
    setProcessing(false)
    setPhotoStatuses([])
    setCurrentIdx(0)
    setResults(null)
    setUploadError(null)
    if (inputRef.current) inputRef.current.value = ''
    router.refresh()
  }

  function updateStatus(idx: number, patch: Partial<PhotoStatus>) {
    setPhotoStatuses((prev) =>
      prev.map((s) => (s.index === idx + 1 ? { ...s, ...patch } : s)),
    )
  }

  async function handleAnalyze() {
    if (files.length === 0) return
    setProcessing(true)
    setUploadError(null)

    const initialStatuses: PhotoStatus[] = files.map((f, i) => ({
      index: i + 1,
      name: f.name,
      phase: 'waiting',
    }))
    setPhotoStatuses(initialStatuses)

    const accumulated: AccumulatedResults = {
      stickers: [],
      packIds: [],
      userId: '',
      failedCount: 0,
      successCount: 0,
    }

    for (let i = 0; i < files.length; i++) {
      setCurrentIdx(i)
      const file = files[i]

      // ── 1. Upload ──────────────────────────────────────────
      updateStatus(i, { phase: 'uploading' })

      const fd = new FormData()
      fd.append('photo', file)

      let packId: string
      let userId: string
      try {
        const uploadResult = await uploadPack({}, fd)
        if (uploadResult.error || !uploadResult.pack_id || !uploadResult.user_id) {
          updateStatus(i, { phase: 'failed', error: uploadResult.error ?? 'Upload échoué' })
          accumulated.failedCount++
          continue
        }
        packId = uploadResult.pack_id
        userId = uploadResult.user_id
        if (!accumulated.userId) accumulated.userId = userId
      } catch (err) {
        updateStatus(i, { phase: 'failed', error: err instanceof Error ? err.message : 'Erreur upload' })
        accumulated.failedCount++
        continue
      }

      // ── 2. Analyse IA ──────────────────────────────────────
      updateStatus(i, { phase: 'analyzing' })

      try {
        const res = await fetch('/api/scan-process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pack_id: packId, user_id: userId }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error ?? `HTTP ${res.status}`)
        }

        const data = await res.json() as ScanResult
        const matchedCount = data.stickers.filter(s => s.sticker_id !== null).length

        accumulated.stickers.push(...data.stickers)
        accumulated.packIds.push(packId)
        accumulated.successCount++

        updateStatus(i, { phase: 'done', stickerCount: matchedCount })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Analyse échouée'
        updateStatus(i, { phase: 'failed', error: msg })
        accumulated.failedCount++
      }
    }

    setResults(accumulated)
    setProcessing(false)
  }

  const total = files.length
  const doneCount = photoStatuses.filter(s => s.phase === 'done' || s.phase === 'failed').length
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const currentStatus = photoStatuses[currentIdx]

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Scanner des stickers</h1>
        <p className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
          📸 Prends une photo ici ou dépose plusieurs photos d&apos;un coup si tu les as déjà prises.
          Chaque photo est analysée automatiquement.
        </p>
        <p className="mt-2 rounded-xl bg-white/5 px-4 py-3 text-xs text-gray-500">
          ℹ️ Seuls les stickers portraits de joueurs sont reconnus. Les stickers de photos d&apos;équipes,
          logos de sélections nationales et pages spéciales ne sont pas comptabilisés pour l&apos;instant.
        </p>
      </div>

      {/* ── Phase : traitement en cours ── */}
      {processing && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-5 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <Spinner size={4} />
              <p className="text-sm font-medium text-orange-300">
                {currentStatus?.phase === 'uploading' && `⬆️ Upload photo ${currentIdx + 1}/${total}…`}
                {currentStatus?.phase === 'analyzing' && `🔍 Analyse en cours… Photo ${currentIdx + 1}/${total}`}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-orange-300/70">{doneCount}/{total} photos traitées</span>
                <span className="text-xs tabular-nums text-orange-300/70">{progressPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, backgroundColor: '#f97316' }}
                />
              </div>
            </div>
          </div>

          <ul className="space-y-1.5">
            {photoStatuses.map((s) => (
              <li
                key={s.index}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors ${
                  s.phase === 'done'    ? 'bg-green-500/10 border border-green-500/20' :
                  s.phase === 'failed' ? 'bg-red-500/10 border border-red-500/20' :
                  s.phase === 'waiting'? 'bg-white/[0.03] border border-white/5' :
                  'bg-orange-500/10 border border-orange-500/20'
                }`}
              >
                <span className="shrink-0 w-4 text-center text-xs">{phaseIcon(s.phase)}</span>
                <span className={`flex-1 truncate ${s.phase === 'waiting' ? 'text-gray-600' : 'text-gray-300'}`}>
                  Photo {s.index}/{total}
                </span>
                {s.phase === 'done' && s.stickerCount !== undefined && (
                  <span className="shrink-0 text-xs text-green-400">{s.stickerCount} sticker{s.stickerCount !== 1 ? 's' : ''}</span>
                )}
                {s.phase === 'failed' && s.error && (
                  <span className="shrink-0 text-xs text-red-400 truncate max-w-[120px]">{s.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Phase : sélection + preview ── */}
      {!processing && !results && (
        <div className="space-y-5">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          {files.length === 0 ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 bg-transparent px-6 py-16 text-center hover:border-orange-500/50 hover:bg-white/10 transition-colors"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/20">
                <svg className="h-7 w-7 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-300">Sélectionner une ou plusieurs photos</p>
                <p className="mt-0.5 text-xs text-gray-500">Caméra · Galerie · Multi-sélection (max 5 photos)</p>
              </div>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">
                  {files.length} photo{files.length > 1 ? 's' : ''} sélectionnée{files.length > 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  Changer
                </button>
              </div>

              <div className={`grid gap-2 ${files.length === 1 ? 'grid-cols-1' : 'grid-cols-3 sm:grid-cols-4'}`}>
                {previews.map((url, i) => (
                  <div
                    key={i}
                    className={`relative overflow-hidden rounded-xl border border-white/10 bg-white/5 ${files.length === 1 ? 'h-48' : 'h-24'}`}
                  >
                    <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" unoptimized />
                  </div>
                ))}
              </div>

              {uploadError && (
                <p className="rounded-lg bg-red-900/40 border border-red-700/50 px-3 py-2 text-sm text-red-300">
                  {uploadError}
                </p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={handleReset}
                  className="flex-1 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors"
                >
                  Annuler
                </button>
                <button type="button" onClick={handleAnalyze}
                  className="flex-1 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 transition-colors"
                >
                  Analyser {files.length > 1 ? `${files.length} photos` : 'la photo'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Résultats après traitement — log visible derrière la modale ── */}
      {!processing && results && (
        <>
          <div className="space-y-1.5 mb-4">
            {photoStatuses.map((s) => (
              <div
                key={s.index}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm ${
                  s.phase === 'done'   ? 'bg-green-500/10 border border-green-500/20' :
                  s.phase === 'failed' ? 'bg-red-500/10 border border-red-500/20' : 'bg-white/5'
                }`}
              >
                <span className="w-4 text-center text-xs">{phaseIcon(s.phase)}</span>
                <span className="flex-1 text-gray-300">Photo {s.index}/{total}</span>
                {s.phase === 'done' && s.stickerCount !== undefined && (
                  <span className="text-xs text-green-400">{s.stickerCount} sticker{s.stickerCount !== 1 ? 's' : ''}</span>
                )}
                {s.phase === 'failed' && (
                  <span className="text-xs text-red-400">{s.error ?? 'Échouée'}</span>
                )}
              </div>
            ))}
          </div>
          <ResultsModal results={results} onDone={handleReset} />
        </>
      )}
    </div>
  )
}
