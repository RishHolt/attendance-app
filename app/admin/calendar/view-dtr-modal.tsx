"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Modal, Button } from "@/components/ui"

type ViewDtrModalProps = {
  open: boolean
  onClose: () => void
  currentMonthLabel: string
  userId: string | null
  month: number
  year: number
  fileBaseName: string
}

export const ViewDtrModal = ({
  open,
  onClose,
  currentMonthLabel,
  userId,
  month,
  year,
  fileBaseName,
}: ViewDtrModalProps) => {
  const previewRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!open) {
      setPreviewBlob(null)
      setPreviewReady(false)
      setError(null)
      setLoading(false)
      if (previewRef.current) previewRef.current.innerHTML = ""
      return
    }
    if (!userId) return

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setPreviewReady(false)
      setPreviewBlob(null)
      try {
        const res = await fetch("/api/dtr/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            month,
            year,
          }),
        })
        if (!res.ok) throw new Error("Failed to load DTR")
        const blob = await res.blob()
        if (!cancelled) setPreviewBlob(blob)
      } catch {
        if (!cancelled) setError("Could not load DTR preview.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open, userId, month, year])

  useLayoutEffect(() => {
    if (!previewBlob) {
      setPreviewReady(false)
      return
    }
    const el = previewRef.current
    if (!el) return

    el.innerHTML = ""
    setPreviewReady(false)
    let cancelled = false

    const run = async () => {
      try {
        const { renderAsync } = await import("docx-preview")
        if (cancelled) return
        await renderAsync(previewBlob, el, undefined, {
          className: "docx-preview",
          inWrapper: true,
          ignoreWidth: false,
          breakPages: false,
        })
        if (!cancelled) setPreviewReady(true)
      } catch {
        if (!cancelled) {
          setError("Could not render DTR preview.")
          setPreviewReady(false)
        }
      }
    }
    void run()

    return () => {
      cancelled = true
      if (el.parentNode) el.innerHTML = ""
    }
  }, [previewBlob])

  const handleExportDtr = useCallback(async () => {
    if (!userId) return
    setExporting(true)
    try {
      const res = await fetch("/api/dtr/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, month, year }),
      })
      if (!res.ok) throw new Error("Export failed")

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${fileBaseName}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert("Failed to export DTR. Please try again.")
    } finally {
      setExporting(false)
    }
  }, [userId, month, year, fileBaseName])

  const handlePrint = useCallback(() => {
    const el = previewRef.current
    if (!el || !el.innerHTML.trim()) return

    const iframe = document.createElement("iframe")
    iframe.setAttribute("aria-hidden", "true")
    iframe.style.cssText =
      "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;right:0;bottom:0"

    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    if (!doc) {
      iframe.remove()
      return
    }

    /** Empty <title> avoids "DTR" in the browser print header (when headers are on). */
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title></title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;margin:12px;padding:0;color:#111;background:#fff}
  .docx-wrapper{
    background:#fff!important;
    background-image:none!important;
  }
  .docx-wrapper,.docx-wrapper>section.docx,section.docx,.docx,.docx-page{
    box-shadow:none!important;
    filter:none!important;
    text-shadow:none!important;
  }
  @media print{
    html,body{height:auto!important;overflow:visible!important}
    body{margin:0;padding:0}
    *{box-shadow:none!important;filter:none!important}
    /* docx-preview sets section min-height to full page — that reserves a second blank page when printing */
    [class$="-wrapper"]{
      display:block!important;
      padding:0!important;
      margin:0!important;
      min-height:0!important;
      align-items:stretch!important;
    }
    [class$="-wrapper"]>section{
      min-height:auto!important;
      height:auto!important;
      max-height:none!important;
      overflow:visible!important;
      margin:0!important;
      margin-bottom:0!important;
      page-break-after:auto!important;
    }
    [class$="-wrapper"]>section>article{min-height:0!important;margin-bottom:0!important}
    [class$="-wrapper"],[class$="-wrapper"]>section{
      box-shadow:none!important;
      filter:none!important;
    }
  }
</style></head><body>${el.innerHTML}</body></html>`

    doc.open()
    doc.write(html)
    doc.close()

    const win = iframe.contentWindow
    if (!win) {
      iframe.remove()
      return
    }

    const cleanup = () => {
      iframe.remove()
    }

    const runPrint = () => {
      win.focus()
      win.print()
      setTimeout(cleanup, 500)
    }

    setTimeout(runPrint, 100)
  }, [])

  const canPrint = !loading && !error && previewReady && previewBlob !== null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="View DTR"
      description={`Daily Time Record — ${currentMonthLabel}`}
      maxWidthClassName="max-w-6xl"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handlePrint}
            disabled={!canPrint}
            aria-label="Print DTR preview"
          >
            Print
          </Button>
          <Button
            type="button"
            onClick={handleExportDtr}
            disabled={!userId || exporting}
            aria-label="Export DTR as Word document"
          >
            {exporting ? "Exporting…" : "Export DTR"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          className="min-h-[240px] max-h-[55dvh] overflow-auto rounded-xl border border-zinc-200/80 bg-white p-3 dark:border-zinc-700/80 dark:bg-zinc-950/40"
          aria-busy={loading}
        >
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading preview…</p>
            </div>
          )}
          {error && !loading && (
            <p className="py-8 text-center text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && previewBlob && (
            <div
              ref={previewRef}
              className="docx-preview-root min-h-[200px] [&_.docx-wrapper]:max-w-none [&_.docx-wrapper]:font-sans [&_.docx-wrapper]:shadow-none [&_.docx]:shadow-none [&_section.docx]:shadow-none [&_.docx-page]:shadow-none"
            />
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Use Export to download the document.
        </p>
      </div>
    </Modal>
  )
}
