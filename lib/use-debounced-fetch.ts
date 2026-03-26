"use client"

import { useCallback, useRef } from "react"

type DebouncedFetchOptions = {
  delay?: number
}

export const useDebouncedFetch = ({ delay = 300 }: DebouncedFetchOptions = {}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const debouncedFetch = useCallback(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      return new Promise((resolve, reject) => {
        if (timerRef.current) clearTimeout(timerRef.current)

        controllerRef.current?.abort()
        controllerRef.current = new AbortController()
        const signal = controllerRef.current.signal

        timerRef.current = setTimeout(async () => {
          try {
            const response = await fetch(input, { ...init, signal })
            resolve(response)
          } catch (err) {
            if ((err as Error).name !== "AbortError") {
              reject(err)
            }
          }
        }, delay)
      })
    },
    [delay]
  )

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    controllerRef.current?.abort()
  }, [])

  return { debouncedFetch, cancel }
}
