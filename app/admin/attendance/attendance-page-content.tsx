"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarCheck, CheckCircle2, Clock, Edit3, AlertCircle, LogOut, QrCode, Search, XCircle, CheckSquare, Square } from "lucide-react"
import { Button, Card, Input, Pagination } from "@/components/ui"
import { AddTimeOutModal } from "./add-time-out-modal"
import { DenyAttendanceModal } from "./deny-attendance-modal"
import { QrAttendanceModal } from "./qr-attendance-modal"
import { PageHeader } from "@/components/admin/page-header"
import { formatTime12 } from "@/lib/format-time"
import { swal } from "@/lib/swal"
import { useDebounce } from "@/lib/use-debounce"
import type { AdminAttendanceRow } from "@/types"

type TabValue = "pending" | "approved" | "denied" | "incomplete" | "corrections"

const PAGE_SIZE = 10

type CorrectionRow = {
  id: string
  attendanceId: string
  userId: string
  fullName: string
  userDisplayId: string
  date: string
  currentTimeIn: string | null
  currentTimeOut: string | null
  requestedTimeIn: string | null
  requestedTimeOut: string | null
  reason: string | null
  status: string
  createdAt: string
}

type AttendancesResponse = { rows: AdminAttendanceRow[]; total: number }

const fetchAttendances = async (
  tab: TabValue,
  page: number,
  search: string
): Promise<AttendancesResponse> => {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  if (tab === "incomplete") {
    params.set("status", "incomplete")
  } else if (tab !== "corrections") {
    params.set("approval_status", tab)
  }
  if (search.trim()) {
    params.set("search", search.trim())
  }
  const res = await fetch(`/api/attendances?${params.toString()}`)
  if (!res.ok) return { rows: [], total: 0 }
  return res.json()
}

const fetchCorrections = async (
  status: string,
  page: number
): Promise<{ rows: CorrectionRow[]; total: number }> => {
  const res = await fetch(
    `/api/attendance-corrections?status=${status}&page=${page}&limit=${PAGE_SIZE}`
  )
  if (!res.ok) return { rows: [], total: 0 }
  return res.json()
}

export const AttendancePageContent = () => {
  const [attendances, setAttendances] = useState<AdminAttendanceRow[]>([])
  const [corrections, setCorrections] = useState<CorrectionRow[]>([])
  const [tab, setTab] = useState<TabValue>("pending")
  const [isLoading, setIsLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [denyingId, setDenyingId] = useState<string | null>(null)
  const [correctionActionId, setCorrectionActionId] = useState<string | null>(null)
  const [addTimeOutRow, setAddTimeOutRow] = useState<AdminAttendanceRow | null>(null)
  const [addingTimeOutId, setAddingTimeOutId] = useState<string | null>(null)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [denyModalRow, setDenyModalRow] = useState<AdminAttendanceRow | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 400)
  const [selectedAttendances, setSelectedAttendances] = useState<Set<string>>(new Set())
  const [selectedCorrections, setSelectedCorrections] = useState<Set<string>>(new Set())
  const [isBulkApproving, setIsBulkApproving] = useState(false)

  const getAttendanceSelectionKey = (row: Pick<AdminAttendanceRow, "id" | "userId">) =>
    `${row.userId}:${row.id}`

  const isAttendanceSelectable = (r: AdminAttendanceRow) =>
    tab !== "pending" || !!r.timeOut

  const loadData = useCallback(async () => {
    setIsLoading(true)
    if (tab === "corrections") {
      const data = await fetchCorrections("pending", page)
      setCorrections(data.rows)
      setTotal(data.total)
    } else {
      const data = await fetchAttendances(tab, page, debouncedSearch)
      setAttendances(data.rows)
      setTotal(data.total)
    }
    setIsLoading(false)
  }, [tab, page, debouncedSearch])

  useEffect(() => {
    setPage(1)
  }, [tab])

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    // Clear selections when tab changes
    setSelectedAttendances(new Set())
    setSelectedCorrections(new Set())
  }, [tab])

  const handleBulkApproveAttendances = async () => {
    if (selectedAttendances.size === 0) return
    
    setIsBulkApproving(true)
    try {
      const approvePromises = Array.from(selectedAttendances).map(async (key) => {
        const [userId, attendanceId] = key.split(":")
        if (!userId || !attendanceId) return false

        const res = await fetch(
          `/api/users/${userId}/attendances/${attendanceId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approvalStatus: "approved" }),
          }
        )
        return res.ok
      })
      
      const results = await Promise.all(approvePromises)
      const failedCount = results.filter(r => !r).length
      
      if (failedCount === 0) {
        await swal.success(`${selectedAttendances.size} attendance record(s) approved`)
      } else {
        await swal.error(`${failedCount} out of ${selectedAttendances.size} records failed to approve`)
      }
      
      setSelectedAttendances(new Set())
      loadData()
    } catch {
      swal.error("Failed to bulk approve attendances")
    } finally {
      setIsBulkApproving(false)
    }
  }

  const handleBulkApproveCorrections = async () => {
    if (selectedCorrections.size === 0) return
    
    setIsBulkApproving(true)
    try {
      const approvePromises = Array.from(selectedCorrections).map(async (id) => {
        const res = await fetch(`/api/attendance-corrections/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        })
        return res.ok
      })
      
      const results = await Promise.all(approvePromises)
      const failedCount = results.filter(r => !r).length
      
      if (failedCount === 0) {
        await swal.success(`${selectedCorrections.size} correction request(s) approved`)
      } else {
        await swal.error(`${failedCount} out of ${selectedCorrections.size} requests failed to approve`)
      }
      
      setSelectedCorrections(new Set())
      loadData()
    } catch {
      swal.error("Failed to bulk approve corrections")
    } finally {
      setIsBulkApproving(false)
    }
  }

  const toggleAttendanceSelection = (id: string) => {
    setSelectedAttendances(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleCorrectionSelection = (id: string) => {
    setSelectedCorrections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleAllAttendances = () => {
    const selectableAttendances = attendances.filter(isAttendanceSelectable)

    if (selectedAttendances.size === selectableAttendances.length) {
      setSelectedAttendances(new Set())
    } else {
      setSelectedAttendances(new Set(selectableAttendances.map((r) => getAttendanceSelectionKey(r))))
    }
  }

  const toggleAllCorrections = () => {
    if (selectedCorrections.size === corrections.length) {
      setSelectedCorrections(new Set())
    } else {
      setSelectedCorrections(new Set(corrections.map(r => r.id)))
    }
  }

  const shouldShowBulkActions = tab === "pending" || tab === "corrections"
  const isPendingTab = tab === "pending"
  const selectedCount = isPendingTab ? selectedAttendances.size : selectedCorrections.size
  const totalCount = isPendingTab ? attendances.filter(isAttendanceSelectable).length : corrections.length
  const allSelected = selectedCount === totalCount && totalCount > 0

  const handleApprove = async (row: AdminAttendanceRow) => {
    setApprovingId(row.id)
    try {
      const res = await fetch(
        `/api/users/${row.userId}/attendances/${row.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalStatus: "approved" }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        swal.error(data.error ?? "Failed to approve")
        return
      }
      await swal.success("Attendance approved")
      loadData()
    } catch {
      swal.error("Failed to approve")
    } finally {
      setApprovingId(null)
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleDenyClick = (row: AdminAttendanceRow) => {
    setDenyModalRow(row)
  }

  const handleCorrectionApprove = async (row: CorrectionRow) => {
    setCorrectionActionId(row.id)
    try {
      const res = await fetch(`/api/attendance-corrections/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      })
      if (!res.ok) {
        const data = await res.json()
        swal.error(data.error ?? "Failed to approve")
        return
      }
      await swal.success("Correction approved")
      loadData()
    } catch {
      swal.error("Failed to approve")
    } finally {
      setCorrectionActionId(null)
    }
  }

  const handleAddTimeOut = async (timeOut: string) => {
    if (!addTimeOutRow) return
    setAddingTimeOutId(addTimeOutRow.id)
    try {
      const res = await fetch(
        `/api/users/${addTimeOutRow.userId}/attendances/${addTimeOutRow.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timeOut,
          }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        swal.error(data.error ?? "Failed to add time out")
        return
      }
      await swal.success("Time out added. Record moved to Pending.")
      setAddTimeOutRow(null)
      loadData()
    } catch {
      swal.error("Failed to add time out")
    } finally {
      setAddingTimeOutId(null)
    }
  }

  const handleCorrectionReject = async (row: CorrectionRow) => {
    setCorrectionActionId(row.id)
    try {
      const res = await fetch(`/api/attendance-corrections/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      })
      if (!res.ok) {
        const data = await res.json()
        swal.error(data.error ?? "Failed to reject")
        return
      }
      await swal.success("Correction rejected")
      loadData()
    } catch {
      swal.error("Failed to reject")
    } finally {
      setCorrectionActionId(null)
    }
  }

  const handleDenyConfirm = async (remarks: string) => {
    if (!denyModalRow) return
    setDenyingId(denyModalRow.id)
    try {
      const res = await fetch(
        `/api/users/${denyModalRow.userId}/attendances/${denyModalRow.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalStatus: "denied", remarks: remarks || null }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        swal.error(data.error ?? "Failed to deny")
        return
      }
      await swal.success("Attendance denied")
      setDenyModalRow(null)
      loadData()
    } catch {
      swal.error("Failed to deny")
    } finally {
      setDenyingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="View and approve attendance records"
        actions={
          <Button
            variant="secondary"
            leftIcon={<QrCode className="h-4 w-4" />}
            onClick={() => setQrModalOpen(true)}
            aria-label="Show QR attendance code"
          >
            QR Attendance
          </Button>
        }
      />

      <QrAttendanceModal open={qrModalOpen} onClose={() => setQrModalOpen(false)} />

      <DenyAttendanceModal
        open={!!denyModalRow}
        onClose={() => setDenyModalRow(null)}
        row={denyModalRow}
        onDeny={handleDenyConfirm}
        isDenying={!!denyingId}
      />

      <AddTimeOutModal
        open={!!addTimeOutRow}
        onClose={() => setAddTimeOutRow(null)}
        row={addTimeOutRow}
        onSuccess={handleAddTimeOut}
        isSubmitting={!!addingTimeOutId}
      />

      <Card variant="default" padding="md">
        {tab !== "corrections" && (
          <div className="mb-4 flex flex-wrap items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <label htmlFor="attendance-search" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Filter by employee
            </label>
            <div className="relative min-w-0 flex-1 sm:min-w-[200px] sm:max-w-sm">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                aria-hidden
              />
              <Input
                id="attendance-search"
                type="search"
                placeholder="Search by name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Filter attendances by employee name or ID"
                className="pl-10"
              />
            </div>
          </div>
        )}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          {(
            [
              { value: "pending" as TabValue, label: "Pending", icon: Clock },
              { value: "approved" as TabValue, label: "Approved", icon: CheckCircle2 },
              { value: "denied" as TabValue, label: "Denied", icon: XCircle },
              { value: "incomplete" as TabValue, label: "Incomplete", icon: AlertCircle },
              { value: "corrections" as TabValue, label: "Corrections", icon: Edit3 },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              aria-label={`Show ${label} attendances`}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => setTab(value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setTab(value)
                }
              }}
              className={`flex flex-1 items-center justify-center gap-2 pb-3 pt-1 text-sm font-medium transition-colors ${
                tab === value
                  ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "-mb-px border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                Loading attendances…
              </p>
            </div>
          ) : tab === "corrections" ? (
            corrections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <Edit3 className="h-8 w-8 text-zinc-400" aria-hidden />
                </div>
                <h3 className="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                  No pending correction requests
                </h3>
                <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                  Correction requests from users will appear here
                </p>
              </div>
            ) : (
              <>
                {shouldShowBulkActions && (
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => isPendingTab ? toggleAllAttendances() : toggleAllCorrections()}
                        className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      >
                        {allSelected ? (
                          <><CheckSquare className="h-4 w-4" /> Deselect All</>
                        ) : (
                          <><Square className="h-4 w-4" /> Select All</>
                        )}
                      </button>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {selectedCount} of {totalCount} selected
                      </span>
                    </div>
                    <Button
                      onClick={() => isPendingTab ? handleBulkApproveAttendances() : handleBulkApproveCorrections()}
                      disabled={isBulkApproving || selectedCount === 0}
                      isLoading={isBulkApproving}
                      leftIcon={<CheckCircle2 className="h-4 w-4" />}
                      size="sm"
                    >
                      Approve Selected ({selectedCount})
                    </Button>
                  </div>
                )}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800">
                        {shouldShowBulkActions && (
                          <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 w-12">
                            <button
                              type="button"
                              onClick={() => isPendingTab ? toggleAllAttendances() : toggleAllCorrections()}
                              className="flex items-center justify-center"
                              aria-label={allSelected ? "Deselect all" : "Select all"}
                            >
                              {allSelected ? (
                                <CheckSquare className="h-4 w-4" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          </th>
                        )}
                        <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Date
                        </th>
                        <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Employee
                        </th>
                        <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Current
                        </th>
                        <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Requested
                        </th>
                        <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Reason
                        </th>
                        <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {corrections.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-b-0"
                        >
                          {shouldShowBulkActions && (
                            <td className="py-4 pr-4">
                              <button
                                type="button"
                                onClick={() => toggleCorrectionSelection(row.id)}
                                className="flex items-center justify-center"
                                aria-label={selectedCorrections.has(row.id) ? "Deselect correction" : "Select correction"}
                              >
                                {selectedCorrections.has(row.id) ? (
                                  <CheckSquare className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                                ) : (
                                  <Square className="h-4 w-4 text-zinc-400 dark:text-zinc-600" />
                                )}
                              </button>
                            </td>
                          )}
                          <td className="py-4 pr-4 text-sm text-zinc-900 dark:text-zinc-100">
                            {formatDate(row.date)}
                          </td>
                          <td className="py-4 pr-4">
                            <div>
                              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                {row.fullName}
                              </p>
                              {row.userDisplayId && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                  ID: {row.userDisplayId}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 pr-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {row.currentTimeIn ? formatTime12(row.currentTimeIn) : "—"} –{" "}
                            {row.currentTimeOut ? formatTime12(row.currentTimeOut) : "—"}
                          </td>
                          <td className="py-4 pr-4 text-sm text-zinc-600 dark:text-zinc-400">
                            {row.requestedTimeIn ? formatTime12(row.requestedTimeIn) : "—"} –{" "}
                            {row.requestedTimeOut ? formatTime12(row.requestedTimeOut) : "—"}
                          </td>
                          <td className="py-4 pr-4 text-sm text-zinc-600 dark:text-zinc-400 max-w-[150px]">
                            {row.reason || "—"}
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                leftIcon={<CheckCircle2 className="h-4 w-4" />}
                                onClick={() => handleCorrectionApprove(row)}
                                disabled={correctionActionId === row.id}
                                isLoading={correctionActionId === row.id}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                leftIcon={<XCircle className="h-4 w-4" />}
                                onClick={() => handleCorrectionReject(row)}
                                disabled={correctionActionId === row.id}
                              >
                                Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-4 md:hidden">
                  {corrections.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">
                            {row.fullName}
                          </p>
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                            {formatDate(row.date)}
                          </p>
                          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                            Current: {row.currentTimeIn ? formatTime12(row.currentTimeIn) : "—"} –{" "}
                            {row.currentTimeOut ? formatTime12(row.currentTimeOut) : "—"}
                          </p>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Requested: {row.requestedTimeIn ? formatTime12(row.requestedTimeIn) : "—"} –{" "}
                            {row.requestedTimeOut ? formatTime12(row.requestedTimeOut) : "—"}
                          </p>
                          {row.reason && (
                            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                              {row.reason}
                            </p>
                          )}
                        </div>
                        {shouldShowBulkActions && (
                          <button
                            type="button"
                            onClick={() => toggleCorrectionSelection(row.id)}
                            className="flex items-center justify-center p-2"
                            aria-label={selectedCorrections.has(row.id) ? "Deselect correction" : "Select correction"}
                          >
                            {selectedCorrections.has(row.id) ? (
                              <CheckSquare className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                            ) : (
                              <Square className="h-4 w-4 text-zinc-400 dark:text-zinc-600" />
                            )}
                          </button>
                        )}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          leftIcon={<CheckCircle2 className="h-4 w-4" />}
                          onClick={() => handleCorrectionApprove(row)}
                          disabled={correctionActionId === row.id}
                          isLoading={correctionActionId === row.id}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<XCircle className="h-4 w-4" />}
                          onClick={() => handleCorrectionReject(row)}
                          disabled={correctionActionId === row.id}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {corrections.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                    <Pagination
                      page={page}
                      total={total}
                      limit={PAGE_SIZE}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}
              </>
            )
          ) : attendances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <CalendarCheck className="h-8 w-8 text-zinc-400" aria-hidden />
              </div>
              <h3 className="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {tab === "pending"
                  ? "No pending attendances"
                  : tab === "approved"
                    ? "No approved attendances yet"
                    : tab === "denied"
                      ? "No denied attendances"
                      : "No incomplete attendances"}
              </h3>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                {tab === "pending"
                  ? "Attendance records will appear here when users time in"
                  : tab === "approved"
                    ? "Approved records will appear here"
                    : tab === "denied"
                      ? "Denied records will appear here"
                      : "Records with time in but no time out will appear here"}
              </p>
            </div>
          ) : (
            <>
              {shouldShowBulkActions && tab === "pending" && (
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleAllAttendances()}
                      className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                      {allSelected ? (
                        <>
                          <CheckSquare className="h-4 w-4" /> Deselect All
                        </>
                      ) : (
                        <>
                          <Square className="h-4 w-4" /> Select All
                        </>
                      )}
                    </button>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {selectedCount} of {totalCount} selected
                    </span>
                  </div>
                  <Button
                    onClick={() => handleBulkApproveAttendances()}
                    disabled={isBulkApproving || selectedCount === 0}
                    isLoading={isBulkApproving}
                    leftIcon={<CheckCircle2 className="h-4 w-4" />}
                    size="sm"
                  >
                    Approve Selected ({selectedCount})
                  </Button>
                </div>
              )}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      {shouldShowBulkActions && (
                        <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 w-12">
                          <button
                            type="button"
                            onClick={() => isPendingTab ? toggleAllAttendances() : toggleAllCorrections()}
                            className="flex items-center justify-center"
                            aria-label={allSelected ? "Deselect all" : "Select all"}
                          >
                            {allSelected ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </th>
                      )}
                      <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Date
                      </th>
                      <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Employee
                      </th>
                      <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Status
                      </th>
                      <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Time In
                      </th>
                      <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Time Out
                      </th>
                      {tab === "denied" && (
                        <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Remarks
                        </th>
                      )}
                      {(tab === "pending" || tab === "incomplete") && (
                        <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {attendances.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-b-0"
                      >
                        {shouldShowBulkActions && (
                          <td className="py-4 pr-4">
                            <button
                              type="button"
                              onClick={() => toggleAttendanceSelection(getAttendanceSelectionKey(row))}
                              disabled={!isAttendanceSelectable(row)}
                              className="flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={
                                tab === "pending" && !row.timeOut
                                  ? "Attendance cannot be selected until it has a time out"
                                  : selectedAttendances.has(getAttendanceSelectionKey(row))
                                    ? "Deselect attendance"
                                    : "Select attendance"
                              }
                            >
                              {selectedAttendances.has(getAttendanceSelectionKey(row)) ? (
                                <CheckSquare className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                              ) : (
                                <Square className="h-4 w-4 text-zinc-400 dark:text-zinc-600" />
                              )}
                            </button>
                          </td>
                        )}
                        <td className="py-4 pr-4 text-sm text-zinc-900 dark:text-zinc-100">
                          {formatDate(row.date)}
                        </td>
                        <td className="py-4 pr-4">
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">
                              {row.fullName}
                            </p>
                            {row.userDisplayId && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                ID: {row.userDisplayId}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              row.status === "present"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                : row.status === "late"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                  : row.status === "incomplete"
                                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
                                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-4 pr-4 text-sm text-zinc-600 dark:text-zinc-400">
                          {row.timeIn ? formatTime12(row.timeIn) : "—"}
                        </td>
                        <td className="py-4 pr-4 text-sm text-zinc-600 dark:text-zinc-400">
                          {row.timeOut ? formatTime12(row.timeOut) : "—"}
                        </td>
                        {tab === "denied" && (
                          <td className="py-4 text-sm text-zinc-600 dark:text-zinc-400 max-w-[200px]">
                            {row.remarks || "—"}
                          </td>
                        )}
                        {(tab === "pending" || tab === "incomplete") && (
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {tab === "pending" && row.timeOut ? (
                                <>
                                  <Button
                                    size="sm"
                                    leftIcon={<CheckCircle2 className="h-4 w-4" />}
                                    onClick={() => handleApprove(row)}
                                    disabled={approvingId === row.id || denyingId === row.id}
                                    isLoading={approvingId === row.id}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    leftIcon={<XCircle className="h-4 w-4" />}
                                    onClick={() => handleDenyClick(row)}
                                    disabled={approvingId === row.id || denyingId === row.id}
                                    isLoading={denyingId === row.id}
                                  >
                                    Deny
                                  </Button>
                                </>
                              ) : tab === "incomplete" ? (
                                <>
                                  <Button
                                    size="sm"
                                    leftIcon={<LogOut className="h-4 w-4" />}
                                    onClick={() => setAddTimeOutRow(row)}
                                    disabled={addingTimeOutId === row.id || denyingId === row.id}
                                    isLoading={addingTimeOutId === row.id}
                                  >
                                    Add time out
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    leftIcon={<XCircle className="h-4 w-4" />}
                                    onClick={() => handleDenyClick(row)}
                                    disabled={addingTimeOutId === row.id || denyingId === row.id}
                                    isLoading={denyingId === row.id}
                                  >
                                    Deny
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-4 md:hidden">
                {attendances.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {row.fullName}
                        </p>
                        {row.userDisplayId && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            ID: {row.userDisplayId}
                          </p>
                        )}
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {formatDate(row.date)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              row.status === "present"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                : row.status === "late"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                  : row.status === "incomplete"
                                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
                                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            {row.status}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {row.timeIn ? formatTime12(row.timeIn) : "—"} –{" "}
                            {row.timeOut ? formatTime12(row.timeOut) : "—"}
                          </span>
                          {tab === "denied" && row.remarks && (
                            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                              Remarks: {row.remarks}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        {shouldShowBulkActions && (
                          <button
                            type="button"
                            onClick={() => toggleAttendanceSelection(getAttendanceSelectionKey(row))}
                            disabled={tab === "pending" && !row.timeOut}
                            className="flex items-center justify-center p-2 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={
                              tab === "pending" && !row.timeOut
                                ? "Attendance cannot be selected until it has a time out"
                                : selectedAttendances.has(getAttendanceSelectionKey(row))
                                  ? "Deselect attendance"
                                  : "Select attendance"
                            }
                          >
                            {selectedAttendances.has(getAttendanceSelectionKey(row)) ? (
                              <CheckSquare className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                            ) : (
                              <Square className="h-4 w-4 text-zinc-400 dark:text-zinc-600" />
                            )}
                          </button>
                        )}
                        {(tab === "pending" || tab === "incomplete") && (
                          <div className="flex flex-wrap items-center gap-2">
                            {tab === "pending" && row.timeOut ? (
                              <>
                                <Button
                                  size="sm"
                                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                                  onClick={() => handleApprove(row)}
                                  disabled={approvingId === row.id || denyingId === row.id}
                                  isLoading={approvingId === row.id}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  leftIcon={<XCircle className="h-4 w-4" />}
                                  onClick={() => handleDenyClick(row)}
                                  disabled={approvingId === row.id || denyingId === row.id}
                                  isLoading={denyingId === row.id}
                                >
                                  Deny
                                </Button>
                              </>
                            ) : tab === "incomplete" ? (
                              <>
                                <Button
                                  size="sm"
                                  leftIcon={<LogOut className="h-4 w-4" />}
                                  onClick={() => setAddTimeOutRow(row)}
                                  disabled={addingTimeOutId === row.id || denyingId === row.id}
                                  isLoading={addingTimeOutId === row.id}
                                >
                                  Add time out
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  leftIcon={<XCircle className="h-4 w-4" />}
                                  onClick={() => handleDenyClick(row)}
                                  disabled={addingTimeOutId === row.id || denyingId === row.id}
                                  isLoading={denyingId === row.id}
                                >
                                  Deny
                                </Button>
                              </>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {attendances.length > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                  <Pagination
                    page={page}
                    total={total}
                    limit={PAGE_SIZE}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
