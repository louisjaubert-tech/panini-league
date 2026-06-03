import PublicHeader from '@/components/PublicHeader'

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-200 ${className}`} />
}

export default function LeaderboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
        <Skeleton className="mb-2 h-8 w-44" />
        <Skeleton className="mb-8 h-4 w-56" />

        {/* Tableau */}
        <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
          {/* Header */}
          <div className="flex gap-4 bg-gray-50 px-6 py-3.5">
            {[16, 40, 20, 24, 12, 12].map((w, i) => (
              <Skeleton key={i} className={`h-3 w-${w}`} />
            ))}
          </div>
          {/* Rows */}
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-t border-gray-50 px-6 py-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="ml-auto h-5 w-12" />
              <Skeleton className="h-2 w-20 rounded-full" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>

        {/* Cards mobile */}
        <div className="space-y-3 md:hidden">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      </main>
    </div>
  )
}
