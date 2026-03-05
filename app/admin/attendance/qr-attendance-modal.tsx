"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { PDFDocument, rgb } from "pdf-lib"
import { Modal, Button } from "@/components/ui"
import { QrCode, FileDown } from "lucide-react"

const QR_PATH = "/attendance/qr-clock-in"

type QrAttendanceModalProps = {
  open: boolean
  onClose: () => void
}

export const QrAttendanceModal = ({ open, onClose }: QrAttendanceModalProps) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrLink, setQrLink] = useState("")
  const [isNetwork, setIsNetwork] = useState(false)

  useEffect(() => {
    if (!open || typeof window === "undefined") return

    const origin = window.location.origin
    const networkBase = process.env.NEXT_PUBLIC_QR_BASE_URL?.trim()
    const useNetwork =
      !!networkBase && (origin.includes("localhost") || origin.includes("127.0.0.1"))
    const base = useNetwork ? networkBase.replace(/\/$/, "") : origin
    const path = QR_PATH

    const buildUrl = async () => {
      let url = `${base}${path}`
      try {
        const res = await fetch("/api/attendance/qr-token")
        if (res.ok) {
          const data = await res.json()
          const token = data?.token
          if (token) {
            url = `${base}${path}?token=${encodeURIComponent(token)}`
          }
        }
      } catch {
        // No token, use base URL
      }
      setQrLink(url)
      setIsNetwork(useNetwork)

      QRCode.toDataURL(url, {
        type: "image/png",
        width: 256,
        margin: 2,
        color: { dark: "#18181b", light: "#ffffff" },
      })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null))
    }

    buildUrl()
  }, [open])

  const handlePrintPdf = async () => {
    if (!qrDataUrl || !qrLink) return
    try {
      const pdfDoc = await PDFDocument.create()
      const page = pdfDoc.addPage([595, 842])
      const { width, height } = page.getSize()

      const base64 = qrDataUrl.split(",")[1]
      if (!base64) return
      const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const qrImage = await pdfDoc.embedPng(pngBytes)

      const margin = 72
      const contentWidth = width - margin * 2
      const qrSize = 240
      const qrX = (width - qrSize) / 2
      const qrY = height - margin - 90 - qrSize

      page.drawText("Attendance", {
        x: margin,
        y: height - margin - 28,
        size: 28,
        color: rgb(0.1, 0.1, 0.15),
      })

      page.drawText("Scan to time in or time out", {
        x: margin,
        y: height - margin - 52,
        size: 14,
        color: rgb(0.4, 0.4, 0.45),
      })

      const boxPadding = 16
      const boxX = qrX - boxPadding
      const boxY = qrY - boxPadding
      const boxSize = qrSize + boxPadding * 2
      page.drawRectangle({
        x: boxX,
        y: boxY,
        width: boxSize,
        height: boxSize,
        borderColor: rgb(0.9, 0.9, 0.92),
        borderWidth: 1,
      })

      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      })

      page.drawText("Instructions", {
        x: margin,
        y: qrY - 36,
        size: 10,
        color: rgb(0.5, 0.5, 0.55),
      })

      page.drawText("1. Open your phone camera or QR scanner", {
        x: margin,
        y: qrY - 52,
        size: 9,
        color: rgb(0.45, 0.45, 0.5),
      })

      page.drawText("2. Point at the QR code above", {
        x: margin,
        y: qrY - 64,
        size: 9,
        color: rgb(0.45, 0.45, 0.5),
      })

      page.drawText("3. Sign in if prompted. First scan = time in; scan again after 1 hr = time out", {
        x: margin,
        y: qrY - 76,
        size: 9,
        color: rgb(0.45, 0.45, 0.5),
      })

      page.drawText(qrLink, {
        x: margin,
        y: qrY - 100,
        size: 9,
        color: rgb(0.35, 0.35, 0.4),
        maxWidth: contentWidth,
      })

      const footerY = margin - 20
      page.drawText(
        `Generated on ${new Date().toLocaleDateString(undefined, { dateStyle: "medium" })}`,
        {
          x: margin,
          y: footerY,
          size: 8,
          color: rgb(0.6, 0.6, 0.65),
        }
      )

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob(
        [
          pdfBytes.buffer.slice(
            pdfBytes.byteOffset,
            pdfBytes.byteOffset + pdfBytes.byteLength
          ) as ArrayBuffer,
        ],
        { type: "application/pdf" }
      )
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `qr-attendance-${new Date().toISOString().slice(0, 10)}.pdf`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch {
      window.print()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="QR Attendance"
      description="Users scan this QR code to time in (first scan) or time out (after 1 hour cooldown)."
      footer={
        <div className="flex justify-end">
          <Button
            variant="secondary"
            leftIcon={<FileDown className="w-4 h-4" />}
            onClick={handlePrintPdf}
            disabled={!qrDataUrl}
          >
            Download as PDF
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          {qrDataUrl ? (
            <div className="bg-white dark:bg-zinc-800 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl">
              <img
                src={qrDataUrl}
                alt="QR code for time in and time out"
                width={256}
                height={256}
                className="rounded-lg"
              />
            </div>
          ) : (
            <div className="flex justify-center items-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl w-[256px] h-[256px]">
              <QrCode className="w-16 h-16 text-zinc-400" />
            </div>
          )}
          <p className="bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg max-w-xs text-zinc-600 dark:text-zinc-400 text-xs text-center break-all">
            {qrLink ? (
              <>
                {isNetwork && <span className="font-medium">Network: </span>}
                {qrLink}
              </>
            ) : (
              "Loading…"
            )}
          </p>
        </div>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center">
          Display this on a screen or print it. First scan records time in; after 1 hour
          they can scan again to record time out. Sign in if prompted.
        </p>
      </div>
    </Modal>
  )
}
