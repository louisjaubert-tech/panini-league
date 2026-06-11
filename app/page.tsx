import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value

  let isLoggedIn = false
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    isLoggedIn = !!user
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-white" style={{ backgroundColor: '#0a1628' }}>

      {/* ── Logo + Hero ── */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-3 flex justify-center">
          <Image
            src="/paninilogosansfond.png"
            alt="Panini Club"
            width={340}
            height={340}
            className="object-contain drop-shadow-2xl"
            priority
          />
        </div>

        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: '#94a3b8' }}>
          Qui complétera l&apos;album en premier ?{' '}
          <span className="font-semibold text-white">
            Scanne, collecte, échange
          </span>{' '}
          — et grimpe dans le classement.
        </p>

        {/* ── CTA ── */}
        {!isLoggedIn && (
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="rounded-xl px-8 py-3.5 text-base font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#f97316', color: '#fff' }}
            >
              S&apos;inscrire
            </Link>
            <Link
              href="/login"
              className="rounded-xl border px-8 py-3.5 text-base font-bold text-white transition-colors hover:bg-white/10"
              style={{ borderColor: 'rgba(255,255,255,0.3)' }}
            >
              Se connecter
            </Link>
          </div>
        )}
      </div>

      {/* ── Comment ça marche ── */}
      <div className="mx-auto mt-8 max-w-4xl w-full">
        <h2 className="mb-4 text-lg font-bold" style={{ color: '#ffd60a' }}>
          💡 Comment ça marche ?
        </h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            {
              emoji: '📸',
              title: 'Scanne tes stickers',
              desc: "Prends en photo tes stickers. L'IA les reconnaît automatiquement.",
              href: '/scan',
            },
            {
              emoji: '📊',
              title: 'Suis tes stats',
              desc: 'Doublons, badges, taux de complétion… tout en temps réel.',
              href: '/dashboard',
            },
            {
              emoji: '🔄',
              title: 'Échange avec ta ligue',
              desc: "L'app te montre qui peut te donner ses doublons, et à qui donner les tiens.",
              href: '/echanges',
            },
            {
              emoji: '🏆',
              title: 'Découvre ton classement',
              desc: 'Compare ta collection avec tes amis et grimpe dans le classement.',
              href: '/leaderboard',
            },
          ].map(({ emoji, title, desc, href }) => (
            <Link
              key={title}
              href={href}
              className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition-all duration-200 hover:scale-[1.02] hover:border-orange-500/40 hover:bg-white/10"
            >
              <div className="mb-2 text-2xl">{emoji}</div>
              <h3 className="mb-1 text-sm font-bold text-white">{title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: '#64748b' }}>{desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
