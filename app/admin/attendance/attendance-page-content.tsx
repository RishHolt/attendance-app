"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarCheck, CheckCircle2, Clock, QrCode, XCircle } from "lucide-react"
import { Button, Card, Pagination } from "@/components/ui"
import { DenyAttendanceModal } from "./deny-attendance-modal"
import { QrAttendanceModal } from "./qr-attendance-modal"
import { PageHeader } from "@/components/admin/page-header"
import { formatTime12 } from "@/lib/format-time"
import { swal } from "@/lib/swal"
import type { AdminAttendanceRow } from "@/app/api/attendances/route"

type TabValue = "pending" | "approved" | "denied"

const PAGE_SIZE = 10

type AttendancesResponse = { rows: AdminAttendanceRow[]; total: number }

const fetchAttendances = async (
  approvalStatus: TabValue,
  page: number
): Promise<AttendancesResponse> => {
  const res = await fetch(
    `/api/attendances?approval_status=${approvalStatus}&page=${page}&limit=${PAGE_SIZE}`
  )
  if (!res.ok) return { rows: [], total: 0 }
  return res.json()
}

export const AttendancePageContent = () => {
  const [attendances, setAttendances] = useState<AdminAttendanceRow[]>([])
  const [tab, setTab] = useState<TabValue>("pending")
  const [isLoading, setIsLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [denyingId, setDenyingId] = useState<string | null>(null)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [denyModalRow, setDenyModalRow] = useState<AdminAttendanceRow | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const data = await fetchAttendances(tab, page)
    setAttendances(data.rows)
    setTotal(data.total)
    setIsLoading(false)
  }, [tab, page])

  useEffect(() => {
    setPage(1)
  }, [tab])

  useEffect(() => {
    loadData()
  }, [loadData])

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

      <Card variant="default" padding="md">
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          {(
            [
              { value: "pending" as TabValue, label: "Pending", icon: Clock },
              { value: "approved" as TabValue, label: "Approved", icon: CheckCircle2 },
              { value: "denied" as TabValue, label: "Denied", icon: XCircle },
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
                    : "No denied attendances"}
              </h3>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                {tab === "pending"
                  ? "Attendance records will appear here when users clock in"
                  : tab === "approved"
                    ? "Approved records will appear here"
                    : "Denied records will appear here"}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
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
                      {tab === "pending" && (
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
                        className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-0"
                      >
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
                        {tab === "pending" && (
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {row.timeOut ? (
                                <Button
                                  size="sm"
                                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                                  onClick={() => handleApprove(row)}
                                  disabled={approvingId === row.id || denyingId === row.id}
                                  isLoading={approvingId === row.id}
                                >
                                  Approve
                                </Button>
                              ) : (
                                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                  Awaiting clock out
                                </span>
                              )}
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
                      <div>
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
                      {tab === "pending" && (
                        <div className="flex flex-wrap items-center gap-2">
                          {row.timeOut ? (
                            <Button
                              size="sm"
                              leftIcon={<CheckCircle2 className="h-4 w-4" />}
                              onClick={() => handleApprove(row)}
                              disabled={approvingId === row.id || denyingId === row.id}
                              isLoading={approvingId === row.id}
                            >
                              Approve
                            </Button>
                          ) : (
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">
                              Awaiting clock out
                            </span>
                          )}
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
                        </div>
                      )}
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
