"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { motion } from "motion/react"
import { X } from "lucide-react"

type ModalContextValue = {
  requestClose: () => void
}

const ModalContext = createContext<ModalContextValue | null>(null)

export const useModalClose = () => {
  const ctx = useContext(ModalContext)
  return ctx?.requestClose ?? (() => {})
}

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

const TRANSITION = { duration: 0.2, ease: "easeOut" as const }

export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: ModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const prevOpenRef = useRef(open)
  const closeRequestedByUserRef = useRef(false)

  const handleClose = () => {
    if (isExiting) return
    closeRequestedByUserRef.current = true
    setIsExiting(true)
  }

  const handleAnimationComplete = () => {
    if (isExiting) {
      if (closeRequestedByUserRef.current) {
        closeRequestedByUserRef.current = false
        onClose()
      }
      setIsExiting(false)
    }
  }

  useEffect(() => {
    if (prevOpenRef.current && !open) {
      setIsExiting(true)
    }
    prevOpenRef.current = open
  }, [open])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open && !isExiting) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }

    document.addEventListener("keydown", handleEscape)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = ""
    }
  }, [open, isExiting])

  useEffect(() => {
    if (open && !isExiting && panelRef.current) {
      panelRef.current.focus()
    }
  }, [open, isExiting])

  if (!mounted || typeof document === "undefined") return null
  if (!open && !isExiting) return null

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
      aria-describedby={description ? "modal-description" : undefined}
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={TRANSITION}
      onAnimationComplete={handleAnimationComplete}
    >
      <motion.div
        className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm"
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: isExiting ? 0 : 1 }}
        transition={TRANSITION}
      />
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-10 flex w-full max-w-2xl max-h-[90dvh] flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xl dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-zinc-950/50"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{
          opacity: isExiting ? 0 : 1,
          scale: isExiting ? 0.95 : 1,
        }}
        transition={TRANSITION}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-zinc-200/80 px-6 py-4 dark:border-zinc-800/80">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="modal-title"
                className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
              >
                {title}
              </h2>
              {description && (
                <p
                  id="modal-description"
                  className="mt-1 text-sm text-zinc-500 dark:text-zinc-400"
                >
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <ModalContext.Provider value={{ requestClose: handleClose }}>
            {children}
          </ModalContext.Provider>
        </div>
        {footer && (
          <div className="sticky bottom-0 shrink-0 border-t border-zinc-200/80 bg-white px-6 py-4 dark:border-zinc-800/80 dark:bg-zinc-900">
            {footer}
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}
