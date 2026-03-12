"use client"

export const Skeleton = ({ 
  className = "", 
  variant = "default" 
}: { 
  className?: string
  variant?: "default" | "text" | "circular" | "rounded" 
}) => {
  const variantClasses = {
    default: "rounded-lg",
    text: "rounded",
    circular: "rounded-full",
    rounded: "rounded-xl"
  }

  return (
    <div 
      className={`animate-pulse bg-zinc-200 dark:bg-zinc-800 ${variantClasses[variant]} ${className}`}
      aria-hidden="true"
    />
  )
}

export const PageHeaderSkeleton = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" variant="text" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

export const CardSkeleton = ({ 
  count = 1,
  className = ""
}: { 
  count?: number
  className?: string
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" variant="text" />
            <Skeleton className="h-4 w-5/6" variant="text" />
          </div>
        </div>
      ))}
    </div>
  )
}

export const TableSkeleton = ({ 
  rows = 5,
  columns = 4,
  className = ""
}: { 
  rows?: number
  columns?: number
  className?: string
}) => {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="pb-3 pr-4">
                <Skeleton className="h-4 w-20" variant="text" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-b-0"
            >
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="py-4 pr-4">
                  <Skeleton className="h-4 w-full" variant="text" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const StatsCardSkeleton = ({ count = 4 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <Skeleton className="h-4 w-16 mb-2" variant="text" />
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  )
}

export const DashboardSkeleton = () => {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatsCardSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <CardSkeleton count={3} />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <CardSkeleton count={3} />
        </div>
      </div>
    </div>
  )
}

export const AttendancePageSkeleton = () => {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Skeleton className="h-4 w-20" variant="text" />
            <Skeleton className="h-10 w-full sm:w-64" />
          </div>
        </div>
        <div className="p-4">
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-1 pb-3 pt-1">
                <Skeleton className="h-4 w-16 mx-auto" variant="text" />
              </div>
            ))}
          </div>
          <TableSkeleton rows={8} columns={6} />
        </div>
      </div>
    </div>
  )
}

export const CalendarSkeleton = () => {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="text-center">
              <Skeleton className="h-4 w-8 mx-auto" variant="text" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square">
              <Skeleton className="h-full w-full rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const UsersPageSkeleton = () => {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="p-4">
          <TableSkeleton rows={10} columns={5} />
        </div>
      </div>
    </div>
  )
}

export const SchedulePageSkeleton = () => {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <CardSkeleton count={5} />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <CardSkeleton count={5} />
        </div>
      </div>
    </div>
  )
}

export const SettingsPageSkeleton = () => {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="p-6 space-y-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" variant="text" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
