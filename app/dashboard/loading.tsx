import Header from '@/components/Header'

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-200 ${className}`} />
}

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Titre */}
        <Skeleton className="mb-2 h-8 w-56" />
        <Skeleton className="mb-10 h-4 w-72" />

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-gray-200 animate-pulse h-28" />
          ))}
        </div>

        {/* Progress bar */}
        <Skeleton className="mb-8 h-3 w-full rounded-full" />

        {/* Two columns */}
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-3">
            <Skeleton className="h-5 w-32 mb-4" />
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
          <div className="space-y-3">
            <Skeleton className="h-5 w-40 mb-4" />
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
