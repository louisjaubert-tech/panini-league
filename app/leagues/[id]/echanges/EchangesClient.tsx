'use client'

import { useState, useMemo, useTransition } from 'react'
import {
  confirmReception,
  confirmDonation,
  type ExchangeData,
  type Donation,
  type DonationOut,
  type TradeSuccess,
} from '@/app/actions/trades'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDoublons(collection: ExchangeData['members'][number]['collection']) {
  return collection.filter((s) => s.quantity > 1)
}

function ownedSet(collection: ExchangeData['members'][number]['collection']): Set<string> {
  return new Set(collection.filter((s) => s.quantity >= 1).map((s) => s.sticker_id))
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
        active ? 'bg-[#f97316] text-white shadow' : 'text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function StickerCheckList({
  stickers,
  checked,
  onToggle,
}: {
  stickers: { sticker_id: string; display_name: string; quantity: number }[]
  checked: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <ul className="max-h-64 overflow-y-auto space-y-1 rounded-xl border border-white/10 bg-white/5 p-2">
      {stickers.map((s) => (
        <li key={s.sticker_id}>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5 select-none">
            <input
              type="checkbox"
              checked={checked.has(s.sticker_id)}
              onChange={() => onToggle(s.sticker_id)}
              className="h-4 w-4 cursor-pointer rounded border-white/30 accent-[#f97316]"
            />
            <span className="flex-1 text-sm text-white truncate">{s.display_name}</span>
            {s.quantity > 1 && (
              <span className="shrink-0 text-xs text-gray-500">×{s.quantity}</span>
            )}
          </label>
        </li>
      ))}
    </ul>
  )
}

function SuccessBanner({ result, baseMessage }: { result: TradeSuccess; baseMessage: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 rounded-xl border border-green-600/30 bg-green-900/20 px-4 py-3 text-sm font-medium text-green-400">
        {baseMessage}
      </div>
      {result.new_badges.map((b) => (
        <div key={b.badge_id} className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm font-medium text-yellow-300">
          🏅 Nouveau badge débloqué : <span className="font-bold">{b.name}</span>
        </div>
      ))}
      {result.new_trophies.map((t) => (
        <div key={t.trophy_id} className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm font-medium text-yellow-300">
          🏆 Nouveau trophée : <span className="font-bold">{t.name}</span>
        </div>
      ))}
    </div>
  )
}

// ── Encarts explicatifs ───────────────────────────────────────────────────────

function ExplainReceive() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-gray-400 space-y-1">
      <p>
        Voici les doublons que tes amis peuvent te donner.
      </p>
      <p className="italic text-gray-500">
        Ex : Julien a Mbappé en doublon et tu ne l&apos;as pas encore → il apparaît ici.
        Coche les stickers que Julien t&apos;a donnés physiquement puis clique &laquo;&nbsp;Confirmer la réception&nbsp;&raquo;.
      </p>
    </div>
  )
}

function ExplainGive() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-gray-400 space-y-1">
      <p>
        Voici tes doublons utiles à tes amis.
      </p>
      <p className="italic text-gray-500">
        Ex : tu as Messi en doublon et Thibault ne l&apos;a pas → il apparaît ici.
        Coche les stickers que tu as donnés physiquement à Thibault puis clique &laquo;&nbsp;Confirmer le don&nbsp;&raquo;.
      </p>
    </div>
  )
}

// ── Onglet 1 : Ce que je peux recevoir ───────────────────────────────────────

function ReceiveTab({
  me,
  others,
  onReload,
}: {
  me: ExchangeData['members'][number]
  others: ExchangeData['members'][number][]
  onReload?: () => void
}) {
  const myOwned = useMemo(() => ownedSet(me.collection), [me.collection])

  const giversData = useMemo(
    () =>
      others
        .map((member) => ({
          member,
          stickers: getDoublons(member.collection).filter((s) => !myOwned.has(s.sticker_id)),
        }))
        .filter((g) => g.stickers.length > 0),
    [others, myOwned],
  )

  const [selectedGiverId, setSelectedGiverId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [tradeResult, setTradeResult] = useState<TradeSuccess | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setTradeResult(null)
  }

  function selectGiver(id: string) {
    setSelectedGiverId((prev) => (prev === id ? null : id))
    setChecked(new Set())
    setTradeResult(null)
    setError(null)
  }

  function handleConfirm() {
    if (!selectedGiverId || checked.size === 0) return
    const donations: Donation[] = Array.from(checked).map((stickerId) => ({
      giverId: selectedGiverId,
      stickerId,
    }))
    startTransition(async () => {
      const result = await confirmReception(donations)
      if ('error' in result) {
        setError(result.error)
      } else {
        setTradeResult(result)
        setChecked(new Set())
        onReload?.()
      }
    })
  }

  if (giversData.length === 0) {
    return (
      <div className="space-y-3">
        <ExplainReceive />
        <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-gray-500">
          Aucun membre ne peut te donner de stickers pour l&apos;instant.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ExplainReceive />
      <ul className="space-y-2">
        {giversData.map(({ member, stickers }) => {
          const isSelected = selectedGiverId === member.id
          return (
            <li key={member.id}>
              <button
                onClick={() => selectGiver(member.id)}
                className={`w-full rounded-xl border px-5 py-3.5 text-left transition-colors ${
                  isSelected
                    ? 'border-[#f97316]/50 bg-[#f97316]/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/8'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-white">{member.username}</span>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{ backgroundColor: 'rgba(249,115,22,0.2)', color: '#fb923c' }}
                  >
                    {stickers.length} sticker{stickers.length > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {member.username} peut te donner {stickers.length} sticker{stickers.length > 1 ? 's' : ''}
                </p>
              </button>

              {isSelected && (
                <div className="mt-2 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Coche les stickers que tu as reçus physiquement
                  </p>
                  <StickerCheckList stickers={stickers} checked={checked} onToggle={toggleCheck} />
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  {tradeResult && <SuccessBanner result={tradeResult} baseMessage="✅ Collection mise à jour !" />}
                  <button
                    onClick={handleConfirm}
                    disabled={checked.size === 0 || isPending}
                    className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-40"
                    style={{ backgroundColor: '#f97316' }}
                  >
                    {isPending ? 'Enregistrement…' : `Confirmer la réception (${checked.size})`}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Onglet 2 : Ce que je peux donner ─────────────────────────────────────────

function GiveTab({
  me,
  others,
  onReload,
}: {
  me: ExchangeData['members'][number]
  others: ExchangeData['members'][number][]
  onReload?: () => void
}) {
  const myDoublons = useMemo(() => getDoublons(me.collection), [me.collection])

  const receiversData = useMemo(
    () =>
      others
        .map((member) => {
          const theirOwned = ownedSet(member.collection)
          return {
            member,
            stickers: myDoublons.filter((s) => !theirOwned.has(s.sticker_id)),
          }
        })
        .filter((r) => r.stickers.length > 0),
    [others, myDoublons],
  )

  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [tradeResult, setTradeResult] = useState<TradeSuccess | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setTradeResult(null)
  }

  function selectReceiver(id: string) {
    setSelectedReceiverId((prev) => (prev === id ? null : id))
    setChecked(new Set())
    setTradeResult(null)
    setError(null)
  }

  function handleConfirm() {
    if (!selectedReceiverId || checked.size === 0) return
    const donations: DonationOut[] = Array.from(checked).map((stickerId) => ({
      stickerId,
      receiverId: selectedReceiverId,
    }))
    startTransition(async () => {
      const result = await confirmDonation(donations)
      if ('error' in result) {
        setError(result.error)
      } else {
        setTradeResult(result)
        setChecked(new Set())
        onReload?.()
      }
    })
  }

  if (receiversData.length === 0) {
    return (
      <div className="space-y-3">
        <ExplainGive />
        <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-gray-500">
          {myDoublons.length === 0
            ? "Tu n'as aucun sticker en double pour l'instant."
            : 'Tous les membres de ta ligue ont déjà tes doublons.'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ExplainGive />
      <ul className="space-y-2">
        {receiversData.map(({ member, stickers }) => {
          const isSelected = selectedReceiverId === member.id
          return (
            <li key={member.id}>
              <button
                onClick={() => selectReceiver(member.id)}
                className={`w-full rounded-xl border px-5 py-3.5 text-left transition-colors ${
                  isSelected
                    ? 'border-[#ffd60a]/40 bg-[#ffd60a]/5'
                    : 'border-white/10 bg-white/5 hover:bg-white/8'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-white">{member.username}</span>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{ backgroundColor: 'rgba(255,214,10,0.15)', color: '#ffd60a' }}
                  >
                    {stickers.length} sticker{stickers.length > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {member.username} a besoin de {stickers.length} de tes doublons
                </p>
              </button>

              {isSelected && (
                <div className="mt-2 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Coche les stickers que tu vas lui donner physiquement
                  </p>
                  <StickerCheckList stickers={stickers} checked={checked} onToggle={toggleCheck} />
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  {tradeResult && <SuccessBanner result={tradeResult} baseMessage="✅ Don confirmé !" />}
                  <button
                    onClick={handleConfirm}
                    disabled={checked.size === 0 || isPending}
                    className="w-full rounded-xl py-2.5 text-sm font-bold transition-opacity disabled:opacity-40"
                    style={{ backgroundColor: '#ffd60a', color: '#0a1628' }}
                  >
                    {isPending ? 'Enregistrement…' : `Confirmer le don (${checked.size})`}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Export principal ──────────────────────────────────────────────────────────

export default function EchangesClient({
  data,
  leagueId: _leagueId,
  onReload,
}: {
  data: ExchangeData
  leagueId: string
  onReload?: () => void
}) {
  const [tab, setTab] = useState<'receive' | 'give'>('receive')

  const me = data.members.find((m) => m.id === data.currentUserId)!
  const others = data.members.filter((m) => m.id !== data.currentUserId)

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-xl bg-white/5 p-1 w-fit">
        <TabButton active={tab === 'receive'} onClick={() => setTab('receive')}>
          📥 Ce que je peux recevoir
        </TabButton>
        <TabButton active={tab === 'give'} onClick={() => setTab('give')}>
          📤 Ce que je peux donner
        </TabButton>
      </div>

      {tab === 'receive' ? (
        <ReceiveTab me={me} others={others} onReload={onReload} />
      ) : (
        <GiveTab me={me} others={others} onReload={onReload} />
      )}
    </div>
  )
}
