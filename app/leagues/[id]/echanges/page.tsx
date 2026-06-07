import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getExchangeData } from '@/app/actions/trades'
import EchangesClient from './EchangesClient'

export const metadata = {
  title: 'Échanges — Panini Club',
}

export default async function EchangesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // ── Auth ──────────────────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value
  if (!token) redirect('/login')

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) redirect('/login')

  // ── Vérifier que l'utilisateur est membre de la ligue ────────────────────
  const { data: membership } = await supabaseAdmin
    .from('league_members')
    .select('id')
    .eq('league_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/leagues')

  // ── Récupérer le nom de la ligue ─────────────────────────────────────────
  const { data: league } = await supabaseAdmin
    .from('leagues')
    .select('name')
    .eq('id', id)
    .single()

  // ── Données d'échanges ────────────────────────────────────────────────────
  const result = await getExchangeData(id)

  if ('error' in result) {
    // Fallback : redirige vers la liste des ligues si erreur inattendue
    redirect('/leagues')
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-10" style={{ backgroundColor: '#0a1628' }}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <a
            href="/leagues"
            className="mb-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Mes ligues
          </a>
          <h1 className="text-3xl font-black text-white">
            Échanges{' '}
            <span style={{ color: '#ffd60a' }}>{league?.name ?? ''}</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Coordonne tes échanges de stickers en double avec les membres de ta ligue.
          </p>
        </div>

        <EchangesClient data={result} leagueId={id} />
      </div>
    </main>
  )
}
