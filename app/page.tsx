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
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-white" style={{ backgroundColor: '#0a1628' }}>

      {/* ── Logo + Hero ── */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo_panini_club.png"
            alt="Panini Club"
            width={200}
            height={200}
            className="rounded-full object-contain drop-shadow-2xl"
            priority
          />
        </div>

        <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
          <span style={{ color: '#dc2626' }}>Panini</span>{' '}
          <span style={{ color: '#ffd60a' }}>Club</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed sm:text-xl" style={{ color: '#94a3b8' }}>
          Qui complétera l&apos;album en premier ?{' '}
          <span className="font-semibold text-white">
            Scanne, collecte, échange
          </span>{' '}
          — et grimpe dans le classement.
        </p>

        {/* ── CTA ── */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="rounded-xl px-8 py-3.5 text-base font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#dc2626', color: '#fff' }}
            >
              Mon dashboard →
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="rounded-xl px-8 py-3.5 text-base font-bold transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#dc2626', color: '#fff' }}
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
            </>
          )}
        </div>
      </div>

      {/* ── Features ── */}
      <div className="mx-auto mt-24 grid max-w-4xl grid-cols-2 gap-6 sm:grid-cols-4">
        {[
          {
            emoji: '📊',
            title: 'Mes stats',
            desc: 'Visualise ta progression, tes doublons et ton taux de complétion.',
            href: '/dashboard',
          },
          {
            emoji: '🃏',
            title: 'Ma collection',
            desc: 'Parcours ta collection pays par pays et découvre ce qu\'il te manque.',
            href: '/collection',
          },
          {
            emoji: '📸',
            title: 'Scanner',
            desc: 'Prends une photo de ton blister et laisse l\'IA reconnaître chaque sticker automatiquement.',
            href: '/scan',
          },
          {
            emoji: '🏆',
            title: 'Classement',
            desc: 'Compare ta collection avec tes amis et grimpe dans le classement général.',
            href: '/leaderboard',
          },
        ].map(({ emoji, title, desc, href }) => (
          <Link
            key={title}
            href={href}
            className="block rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center transition-all duration-200 hover:scale-[1.03] hover:border-red-600/50 hover:bg-white/10"
          >
            <div className="mb-3 text-4xl">{emoji}</div>
            <h3 className="mb-2 text-base font-bold" style={{ color: '#ffd60a' }}>
              {title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{desc}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
