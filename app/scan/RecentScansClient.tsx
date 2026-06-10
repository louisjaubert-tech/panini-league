'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { PackRow } from './page'

function StatusBadge({ status }: { status: string }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
        ✓ Analysé
      </span>
    )
  }
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/20 px-2.5 py-0.5 text-xs font-medium text-gray-400">
        ↩️ Annulé
      </span>
    )
  }
  if (status === 'pending_confirmation') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
        ⏳ À confirmer
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-0.5 text-xs font-medium text-orange-400">
      ⏳ En attente
    </span>
  )
}

type LightboxEntry = { url: string; label: string }

export default function RecentScansClient({ packs, userId }: { packs: PackRow[]; userId: string }) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<LightboxEntry | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  async function handleCancel(pack: PackRow) {
    const count = pack.stickers.length
    const label = count === 1 ? '1 sticker' : `${count} stickers`
    const confirmed = window.confirm(
      `Es-tu sûr de vouloir retirer ${label} de ta collection ?\n\nCette action est irréversible.`
    )
    if (!confirmed) return

    setCancellingId(pack.id)
    setCancelError(null)

    try {
      const res = await fetch('/api/cancel-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_id: pack.id, user_id: userId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setCancelError(data.error ?? 'Erreur lors de l\'annulation.')
        setCancellingId(null)
        return
      }
      router.refresh()
    } catch {
      setCancelError('Erreur réseau. Réessaie.')
      setCancellingId(null)
    }
  }

  return (
    <>
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 px-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors text-lg"
            aria-label="Fermer"
          >
            ✕
          </button>
          <p className="mb-3 text-sm font-medium text-white/70">{lightbox.label}</p>
          <div
            className="relative overflow-hidden rounded-xl"
            style={{ maxWidth: '90vw', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt="Scan agrandi"
              style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', display: 'block' }}
            />
          </div>
        </div>
      )}

      <section className="mt-12">
        <h2 className="mb-4 text-base font-semibold text-white">📸 Derniers stickers scannés</h2>

        {cancelError && (
          <div className="mb-3 rounded-lg bg-red-900/40 border border-red-700/50 px-3 py-2 text-sm text-red-300">
            {cancelError}
          </div>
        )}

        {packs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center text-sm text-gray-500">
            Aucun sticker scanné pour l&apos;instant. Lance-toi&nbsp;!&nbsp;📸
          </div>
        ) : (
          <ul className="space-y-2">
            {packs.map((pack) => {
              const isExpanded = expandedId === pack.id
              const hasStickers = pack.stickers.length > 0
              const isDone = pack.ocr_status === 'done'
              const isCancelled = pack.ocr_status === 'cancelled'
              const isCancelling = cancellingId === pack.id

              return (
                <li key={pack.id}>
                  {/* Ligne principale */}
                  <button
                    onClick={() => hasStickers && !isCancelled && setExpandedId(isExpanded ? null : pack.id)}
                    className={`w-full flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors ${
                      hasStickers && !isCancelled ? 'cursor-pointer hover:bg-white/8' : 'cursor-default'
                    } ${isExpanded ? 'rounded-b-none border-b-0' : ''}`}
                  >
                    {/* Miniature */}
                    <div
                      className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white/10 ${pack.photo_url && !isCancelled ? 'cursor-zoom-in' : ''}`}
                      onClick={(e) => {
                        if (!pack.photo_url || isCancelled) return
                        e.stopPropagation()
                        const date = new Date(pack.opened_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                        const label = `${date}${pack.stickers.length > 0 ? ` · ${pack.stickers.length} sticker${pack.stickers.length > 1 ? 's' : ''}` : ''}`
                        setLightbox({ url: pack.photo_url, label })
                      }}
                    >
                      {pack.photo_url ? (
                        <Image
                          src={pack.photo_url}
                          alt="Scan"
                          fill
                          className={`object-cover ${isCancelled ? 'opacity-40 grayscale' : ''}`}
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-600">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008v.008H13.5V12zm-6 3.75h12a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Infos */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">
                        {new Date(pack.opened_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {new Date(pack.opened_at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {pack.stickers.length > 0 && (
                          <span className="ml-2">
                            · {pack.stickers.length} sticker{pack.stickers.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={pack.ocr_status} />
                      {hasStickers && !isCancelled && (
                        <svg
                          className={`h-4 w-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </button>

                  {/* Liste déroulante des stickers */}
                  {isExpanded && hasStickers && !isCancelled && (
                    <div className="rounded-b-xl border border-t-0 border-white/10 bg-white/[0.03] px-4 py-3">
                      <ul className="space-y-1">
                        {pack.stickers.map((s, idx) => (
                          <li key={idx} className="flex items-center justify-between py-1 text-sm">
                            <span className="text-gray-300">{s.display_name ?? s.sticker_id}</span>
                            {s.is_duplicate && (
                              <span className="ml-2 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                doublon
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>

                      {/* Bouton retrait — uniquement pour les scans confirmés */}
                      {isDone && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCancel(pack) }}
                            disabled={isCancelling}
                            className="w-full rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isCancelling
                              ? 'Retrait en cours…'
                              : `↩️ Retirer ces ${pack.stickers.length} sticker${pack.stickers.length > 1 ? 's' : ''}`}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
