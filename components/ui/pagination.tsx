"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "./button"

type PaginationProps = {
  page: number
  total: number
  limit: number
  onPageChange: (page: number) => void
}

export const Pagination = ({
  page,
  total,
  limit,
  onPageChange,
}: PaginationProps) => {
  const totalPages = Math.ceil(total / limit)
  const start = total === 0 ? 0 : (page - 1) * limit + 1
  const end = Math.min(page * limit, total)
  const hasPrev = page > 1
  const hasNext = page < totalPages

  if (totalPages <= 1) return null

  return (
    <div
      className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center"
      role="navigation"
      aria-label="Pagination"
    >
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<ChevronLeft className="h-4 w-4" />}
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          aria-label="Previous page"
        >
          Previous
        </Button>
        <span className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          rightIcon={<ChevronRight className="h-4 w-4" />}
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </div>
  )
}
