import Link from 'next/link'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'

export default async function HomePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value

  let isLoggedIn = false
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    isLoggedIn = !!user
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-[#0f0f0f] px-4 py-20 text-white">

      {/* ── Hero ── */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-6 flex justify-center gap-3 text-4xl">
          <span>⚽</span>
          <span>🃏</span>
          <span>🏆</span>
        </div>

        <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
          <span style={{ color: '#e63946' }}>Panini</span>{' '}
          <span style={{ color: '#ffd60a' }}>League</span>{' '}
          <span className="text-white">26</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-gray-300 sm:text-xl">
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
              style={{ backgroundColor: '#e63946', color: '#fff' }}
            >
              Mon dashboard →
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="rounded-xl px-8 py-3.5 text-base font-bold transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#e63946', color: '#fff' }}
              >
                S&apos;inscrire
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-white/40 px-8 py-3.5 text-base font-bold text-white transition-colors hover:border-white hover:bg-white/10"
              >
                Se connecter
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Features ── */}
      <div className="mx-auto mt-24 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          {
            emoji: '📸',
            title: 'Scanne tes stickers',
            desc: 'Prends une photo de ton blister et laisse l\'IA reconnaître chaque sticker automatiquement.',
          },
          {
            emoji: '📊',
            title: 'Suis ta collection',
            desc: 'Visualise ta progression, tes doublons et les stickers qu\'il te manque en temps réel.',
          },
          {
            emoji: '🏅',
            title: 'Défie tes potes',
            desc: 'Compare ta collection avec tes amis et grimpe dans le classement général.',
          },
        ].map(({ emoji, title, desc }) => (
          <div
            key={title}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center"
          >
            <div className="mb-3 text-4xl">{emoji}</div>
            <h3
              className="mb-2 text-base font-bold"
              style={{ color: '#ffd60a' }}
            >
              {title}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">{desc}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
