"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  Search,
  UserPlus,
  MoreVertical,
  Pencil,
  UserCheck,
  UserX,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import {
  Button,
  Card,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui"
import { PageHeader } from "@/components/admin/page-header"
import { AddUserModal } from "./add-user-modal"
import { EditUserModal } from "./edit-user-modal"
import Swal from "sweetalert2"
import { swal } from "@/lib/swal"

type UserRow = {
  id: string
  userId: string
  fullName: string
  email: string
  contactNo: string | null
  position: string | null
  status: "active" | "inactive"
  startDate: string | null
  role: "employee" | "admin" | "ojt"
  requiredHours?: number | null
  avatarUrl?: string | null
}

type OjtProgressEntry = { userId: string; hoursCompleted: number; percent: number | null }

const roleBadge: Record<string, { label: string; className: string }> = {
  ojt: { label: "OJT", className: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400" },
  admin: { label: "Admin", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  employee: { label: "Employee", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
}

const fetchUsers = async (): Promise<{ users: UserRow[]; error?: string }> => {
  const res = await fetch("/api/users")
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { users: [], error: data.error ?? `Failed to load users (${res.status})` }
  }
  return { users: Array.isArray(data) ? data : data.users ?? [] }
}

type UserActionsDropdownProps = {
  user: UserRow
  onEdit: (user: UserRow) => void
  onToggleStatus: (user: UserRow) => void
}

const UserActionsDropdown = ({
  user,
  onEdit,
  onToggleStatus,
}: UserActionsDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !triggerRef.current || typeof document === "undefined") return
    const rect = triggerRef.current.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 4,
      left: rect.right - 192,
    })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const handleEdit = () => {
    onEdit(user)
    setIsOpen(false)
  }

  const handleToggleStatus = () => {
    onToggleStatus(user)
    setIsOpen(false)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Actions for ${user.fullName}`}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-50 w-48 min-w-40 rounded-xl border border-zinc-200/80 bg-white py-1 shadow-lg dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-zinc-950/50"
            role="menu"
            style={{ top: position.top, left: position.left }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleEdit}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Pencil className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleToggleStatus}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {user.status === "active" ? (
                <>
                  <UserX className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                  Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                  Activate
                </>
              )}
            </button>
          </div>,
          document.body
        )}
    </>
  )
}

const UserAvatar = ({ user }: { user: UserRow }) => {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.fullName}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
      {user.fullName.charAt(0).toUpperCase()}
    </div>
  )
}

export const UsersPageContent = () => {
  const [search, setSearch] = useState("")
  const [users, setUsers] = useState<UserRow[]>([])
  const [ojtProgress, setOjtProgress] = useState<OjtProgressEntry[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userPage, setUserPage] = useState(1)

  const USERS_PER_PAGE = 10

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      const [{ users: data, error }, progressRes] = await Promise.all([
        fetchUsers(),
        fetch("/api/users/ojt-progress").then((r) => r.ok ? r.json() : []).catch(() => []),
      ])
      setUsers(data)
      setOjtProgress(progressRes)
      setLoadError(error ?? null)
      setIsLoading(false)
    }
    load()
  }, [])

  const handleUsersRefresh = async () => {
    setLoadError(null)
    setIsLoading(true)
    const [{ users: data, error }, progressRes] = await Promise.all([
      fetchUsers(),
      fetch("/api/users/ojt-progress").then((r) => r.ok ? r.json() : []).catch(() => []),
    ])
    setUsers(data)
    setOjtProgress(progressRes)
    setLoadError(error ?? null)
    setIsLoading(false)
  }

  const handleEdit = (user: UserRow) => setEditUser(user)

  const handleToggleStatus = async (user: UserRow) => {
    const newStatus = user.status === "active" ? "inactive" : "active"
    const action = newStatus === "active" ? "activate" : "deactivate"
    if (newStatus === "inactive") {
      const { isConfirmed } = await Swal.fire({
        title: "Deactivate user?",
        text: `This will deactivate ${user.fullName}. They will no longer have access.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Deactivate",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#dc2626",
      })
      if (!isConfirmed) return
    }
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        swal.error(data.error ?? `Failed to ${action} user`)
        return
      }
      await swal.success(`User ${action}d successfully`)
      handleUsersRefresh()
    } catch {
      swal.error(`Failed to ${action} user`)
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase()
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.userId.includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.contactNo?.toLowerCase().includes(q) ?? false) ||
      (u.position?.toLowerCase().includes(q) ?? false)
    )
  })

  const totalUserPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE)
  const currentUserPage = Math.min(Math.max(1, userPage), totalUserPages || 1)
  const paginatedUsers = filteredUsers.slice(
    (currentUserPage - 1) * USERS_PER_PAGE,
    currentUserPage * USERS_PER_PAGE
  )

  useEffect(() => {
    const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE)
    if (totalPages > 0 && userPage > totalPages) setUserPage(totalPages)
  }, [filteredUsers.length, userPage])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setUserPage(1)
  }

  const handleAddUserClick = () => setAddUserOpen(true)

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="View and manage users in the system"
        actions={
          <Button
            leftIcon={<UserPlus className="h-4 w-4" />}
            className="w-full sm:w-auto"
            onClick={handleAddUserClick}
          >
            Add user
          </Button>
        }
      />

      <Card variant="default" padding="md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Search by name, email, contact, or position..."
              value={search}
              onChange={handleSearchChange}
              aria-label="Search users"
              className="pl-10"
            />
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          {loadError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={handleUsersRefresh}
              >
                Try again
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading users…</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Users className="h-8 w-8 text-zinc-400" aria-hidden />
              </div>
              <h3 className="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {users.length === 0 ? "No users yet" : "No results found"}
              </h3>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                {users.length === 0
                  ? "Add your first user to get started"
                  : "Try a different search term"}
              </p>
              {users.length === 0 && (
                <Button
                  leftIcon={<UserPlus className="h-4 w-4" />}
                  className="mt-6"
                  onClick={handleAddUserClick}
                >
                  Add user
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table className="hidden min-w-[520px] md:table">
                <TableHeader>
                  <TableRow variant="header">
                    <TableHead>Name &amp; Email</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead align="right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar user={user} />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {user.fullName}
                            </span>
                            <span className="text-sm text-zinc-500 dark:text-zinc-400">
                              {user.email}
                            </span>
                            <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
                              {user.userId}
                              {user.contactNo ? ` · ${user.contactNo}` : ""}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-zinc-900 dark:text-zinc-100">
                            {user.position || "—"}
                          </span>
                          <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${(roleBadge[user.role] ?? roleBadge.employee).className}`}>
                            {(roleBadge[user.role] ?? roleBadge.employee).label}
                          </span>
                          {user.role === "ojt" && (() => {
                            const p = ojtProgress.find((x) => x.userId === user.id)
                            if (!p || user.requiredHours == null) return null
                            return (
                              <div className="mt-1 w-28">
                                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                                  <span className="tabular-nums">{p.hoursCompleted}h</span>
                                  <span className="tabular-nums">{user.requiredHours}h</span>
                                </div>
                                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                                  <div
                                    className="h-1.5 rounded-full bg-violet-500"
                                    style={{ width: `${p.percent ?? 0}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            user.status === "active"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {user.status}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <div className="flex items-center justify-end">
                          <UserActionsDropdown
                            user={user}
                            onEdit={handleEdit}
                            onToggleStatus={handleToggleStatus}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Mobile card list - shown on small screens instead of table */}
              <div className="space-y-4 md:hidden">
                {paginatedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <UserAvatar user={user} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                            {user.fullName}
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                            ID: {user.userId}
                          </p>
                          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                            {user.email}
                          </p>
                          {user.contactNo && (
                            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {user.contactNo}
                            </p>
                          )}
                          {user.position && (
                            <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
                              {user.position}
                            </p>
                          )}
                          <span className={`mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${(roleBadge[user.role] ?? roleBadge.employee).className}`}>
                            {(roleBadge[user.role] ?? roleBadge.employee).label}
                          </span>
                          {user.role === "ojt" && (() => {
                            const p = ojtProgress.find((x) => x.userId === user.id)
                            if (!p || user.requiredHours == null) return null
                            return (
                              <div className="mt-1 w-32">
                                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                                  <span className="tabular-nums">{p.hoursCompleted}h / {user.requiredHours}h</span>
                                  {p.percent != null && <span className="tabular-nums">{p.percent}%</span>}
                                </div>
                                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                                  <div
                                    className="h-1.5 rounded-full bg-violet-500"
                                    style={{ width: `${p.percent ?? 0}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })()}
                          <div className="mt-1 flex flex-wrap gap-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                user.status === "active"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}
                            >
                              {user.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <UserActionsDropdown
                            user={user}
                            onEdit={handleEdit}
                            onToggleStatus={handleToggleStatus}
                          />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Showing{" "}
                  {filteredUsers.length === 0
                    ? 0
                    : (currentUserPage - 1) * USERS_PER_PAGE + 1}
                  –{Math.min(currentUserPage * USERS_PER_PAGE, filteredUsers.length)} of{" "}
                  {filteredUsers.length} users
                </p>
                {totalUserPages > 1 ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                      disabled={currentUserPage <= 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden />
                    </Button>
                    <span className="min-w-[100px] text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Page {currentUserPage} of {totalUserPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setUserPage((p) => Math.min(totalUserPages, p + 1))}
                      disabled={currentUserPage >= totalUserPages}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </Card>

      <AddUserModal
        open={addUserOpen}
        onClose={() => setAddUserOpen(false)}
        onSuccess={handleUsersRefresh}
      />
      <EditUserModal
        open={!!editUser}
        user={editUser}
        onClose={() => setEditUser(null)}
        onSuccess={handleUsersRefresh}
      />
    </div>
  )
}
