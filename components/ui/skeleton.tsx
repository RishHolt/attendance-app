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

/** Toolbar + stats strip for the admin calendar card (matches calendar-page layout). */
export const CalendarToolbarSkeleton = () => {
  return (
    <>
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-4 py-3 dark:border-zinc-700/80 dark:bg-zinc-800/30 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
          <Skeleton className="h-4 w-44 max-w-full" variant="text" />
          <Skeleton className="h-7 w-24" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl min-h-[44px] shrink-0" />
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center lg:gap-6">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-6 w-full min-w-0">
          <div className="flex flex-row items-center gap-3 w-full min-w-0 flex-1">
            <Skeleton className="h-4 w-24 shrink-0 hidden sm:block" variant="text" />
            <Skeleton className="h-11 w-full min-h-[44px] rounded-xl" />
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4 min-w-0 w-full lg:w-auto">
          <div className="flex items-center gap-1 bg-zinc-50/50 dark:bg-zinc-800/50 p-1 border border-zinc-200 dark:border-zinc-700 rounded-xl w-full lg:w-auto justify-center min-w-0">
            <Skeleton className="h-10 w-10 rounded-lg shrink-0 min-w-[44px] min-h-[44px]" />
            <Skeleton className="h-5 flex-1 lg:min-w-[160px] lg:max-w-[200px] mx-2" variant="text" />
            <Skeleton className="h-10 w-10 rounded-lg shrink-0 min-w-[44px] min-h-[44px]" />
          </div>
          <Skeleton className="h-10 w-full lg:w-[120px] rounded-xl min-h-[44px]" />
        </div>
      </div>
    </>
  )
}

type CalendarGridSkeletonProps = {
  /** Negative horizontal margin to align with page card padding (admin: p-4/md:p-6, user section: p-6). */
  bleed?: "admin" | "user"
}

/** Full calendar grid placeholder (6×7 cells, matches visible month grid). */
export const CalendarGridSkeleton = ({ bleed = "admin" }: CalendarGridSkeletonProps) => {
  const bleedClass = bleed === "user" ? "-mx-6" : "-mx-4 md:-mx-6"
  return (
    <div
      className={`${bleedClass} mt-6 overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-50/30 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/30 md:mt-8`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div className="min-w-[480px] sm:min-w-[540px] md:min-w-[600px]">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/50">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="px-0.5 py-2 text-center sm:px-2 sm:py-3"
            >
              <Skeleton className="mx-auto h-3 w-6 sm:h-4 sm:w-8" variant="text" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[100px] border-b border-r border-zinc-200/80 bg-white p-1.5 dark:border-zinc-700/80 dark:bg-zinc-900 sm:min-h-[110px] sm:p-2 md:p-3"
            >
              <Skeleton className="h-7 w-7 rounded-lg sm:h-8 sm:w-8" />
              <div className="mt-1.5 space-y-1 sm:mt-2 sm:space-y-1.5">
                <Skeleton className="h-3 w-full" variant="text" />
                <Skeleton className="h-3 w-4/5" variant="text" />
                <Skeleton className="h-5 w-14 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const CalendarSkeleton = () => {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="rounded-xl border border-zinc-200 bg-white p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
        <CalendarToolbarSkeleton />
        <CalendarGridSkeleton />
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
