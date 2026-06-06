import LeaderboardClient from './LeaderboardClient'
import { fetchLeaderboard } from '@/app/actions/leaderboard'

export const metadata = {
  title: 'Classement — Panini Club',
  description: 'Classement des collectionneurs Panini Club',
}

export default async function LeaderboardPage() {
  const rows = await fetchLeaderboard()

  return (
    <main className="min-h-screen bg-[#0a1628] px-4 sm:px-6 lg:px-8 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Classement</h1>
          <p className="mt-1 text-sm text-gray-400">
            {rows.length} collectionneurs triés par nombre de cartes uniques.
          </p>
        </div>
        <LeaderboardClient initial={rows} />
      </div>
    </main>
  )
}
