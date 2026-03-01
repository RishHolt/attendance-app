export const checkUserAvailability = async (
  field: "email" | "username" | "contactNo",
  value: string,
  excludeId?: string
): Promise<{ available: boolean }> => {
  const trimmed = value.trim()
  if (!trimmed) return { available: true }
  const params = new URLSearchParams({ field, value: trimmed })
  if (excludeId) params.set("excludeId", excludeId)
  const res = await fetch(`/api/users/check-availability?${params}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? "Check failed")
  return data
}
