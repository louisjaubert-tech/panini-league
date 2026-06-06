import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DashboardClient from './DashboardClient'
import { fetchDashboardData } from '@/app/actions/dashboard'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value

  if (!token) redirect('/login')

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) redirect('/login')

  const data = await fetchDashboardData()
  if (!data) redirect('/login')

  const username =
    (user.user_metadata?.username as string | undefined) ?? user.email ?? 'Joueur'

  return (
    <main className="min-h-screen bg-[#0a1628] px-4 sm:px-6 lg:px-8 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            Mes stats 👋 {username}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Voici l&apos;état de ta collection en temps réel.
          </p>
        </div>
        <DashboardClient userId={user.id} initial={data} />
      </div>
    </main>
  )
}
