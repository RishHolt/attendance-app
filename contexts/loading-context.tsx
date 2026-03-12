"use client"

import { createContext, useContext, useState, ReactNode } from "react"

type LoadingContextType = {
  isLoading: boolean
  setLoading: (loading: boolean) => void
  loadingMessage?: string
  setLoadingMessage: (message?: string) => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export const useLoading = () => {
  const context = useContext(LoadingContext)
  if (!context) {
    throw new Error("useLoading must be used within a LoadingProvider")
  }
  return context
}

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>()

  const setLoading = (loading: boolean) => {
    setIsLoading(loading)
    if (!loading) {
      setLoadingMessage(undefined)
    }
  }

  return (
    <LoadingContext.Provider value={{ 
      isLoading, 
      setLoading, 
      loadingMessage, 
      setLoadingMessage 
    }}>
      {children}
    </LoadingContext.Provider>
  )
}
