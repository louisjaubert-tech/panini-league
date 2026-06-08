import Image from 'next/image'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import ScanClient from './ScanClient'

// ── Types ─────────────────────────────────────────────────────────────────────

type PackRow = {
  id: string
  opened_at: string
  ocr_status: string
  photo_url: string | null
  stickerCount: number
}

// ── Section blisters récents (Server Component) ───────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
        ✓ Analysé
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-0.5 text-xs font-medium text-orange-400">
      ⏳ En attente
    </span>
  )
}

function RecentBlisters({ packs }: { packs: PackRow[] }) {
  if (packs.length === 0) return null

  return (
    <section className="mt-12">
      <h2 className="mb-4 text-base font-semibold text-white">📸 Derniers blisters scannés</h2>
      <ul className="space-y-2">
        {packs.map((pack) => (
          <li
            key={pack.id}
            className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          >
            {/* Miniature */}
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white/10">
              {pack.photo_url ? (
                <Image
                  src={pack.photo_url}
                  alt="Blister"
                  fill
                  className="object-cover"
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
                {pack.stickerCount > 0 && (
                  <span className="ml-2">· {pack.stickerCount} sticker{pack.stickerCount > 1 ? 's' : ''}</span>
                )}
              </p>
            </div>
            <StatusBadge status={pack.ocr_status} />
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Page (Server Component) ───────────────────────────────────────────────────

export default async function ScanPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value
  if (!token) redirect('/login')

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) redirect('/login')

  // Fetch 10 derniers blisters + count de stickers par pack en parallèle
  const { data: packsRaw } = await supabaseAdmin
    .from('pack_openings')
    .select('id, opened_at, ocr_status, photo_url')
    .eq('user_id', user.id)
    .order('opened_at', { ascending: false })
    .limit(10)

  const packIds = (packsRaw ?? []).map((p) => p.id as string)

  // Count stickers par pack
  const stickerCounts = new Map<string, number>()
  if (packIds.length > 0) {
    const { data: stickersRaw } = await supabaseAdmin
      .from('scanned_stickers')
      .select('pack_id')
      .in('pack_id', packIds)

    for (const row of stickersRaw ?? []) {
      const pid = row.pack_id as string
      stickerCounts.set(pid, (stickerCounts.get(pid) ?? 0) + 1)
    }
  }

  const packs: PackRow[] = (packsRaw ?? []).map((p) => ({
    id: p.id as string,
    opened_at: p.opened_at as string,
    ocr_status: p.ocr_status as string,
    photo_url: (p.photo_url as string | null) ?? null,
    stickerCount: stickerCounts.get(p.id as string) ?? 0,
  }))

  return (
    <main className="min-h-screen bg-[#0a1628] px-4 sm:px-6 py-12">
      <div className="mx-auto max-w-lg">
        <ScanClient />
        <RecentBlisters packs={packs} />
      </div>
    </main>
  )
}
