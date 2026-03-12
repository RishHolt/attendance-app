"use client"

import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { 
  DashboardSkeleton, 
  AttendancePageSkeleton, 
  CalendarSkeleton, 
  UsersPageSkeleton, 
  SchedulePageSkeleton, 
  SettingsPageSkeleton 
} from "@/components/ui/skeleton"

type PageTransitionWrapperProps = {
  children: React.ReactNode
  pageType?: "dashboard" | "attendance" | "calendar" | "users" | "schedule" | "settings" | "default"
}

export const PageTransitionWrapper = ({ 
  children, 
  pageType = "default" 
}: PageTransitionWrapperProps) => {
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(false)
  const [displayChildren, setDisplayChildren] = useState(children)

  // Determine skeleton type based on pathname
  const getSkeletonComponent = () => {
    // Check for admin routes first
    if (pathname.startsWith("/admin")) {
      if (pathname.includes("/attendance")) return <AttendancePageSkeleton />
      if (pathname.includes("/calendar")) return <CalendarSkeleton />
      if (pathname.includes("/users")) return <UsersPageSkeleton />
      if (pathname.includes("/schedule")) return <SchedulePageSkeleton />
      if (pathname.includes("/settings")) return <SettingsPageSkeleton />
      if (pathname.includes("/analytics")) return <DashboardSkeleton />
      return <DashboardSkeleton />
    }
    
    // Check for user routes
    if (pathname.startsWith("/user")) {
      if (pathname.includes("/attendance")) return <AttendancePageSkeleton />
      if (pathname.includes("/calendar")) return <CalendarSkeleton />
      if (pathname.includes("/schedule")) return <SchedulePageSkeleton />
      if (pathname.includes("/profile")) return <SettingsPageSkeleton />
      return <DashboardSkeleton />
    }
    
    // Default skeleton for other routes
    return <DashboardSkeleton />
  }

  useEffect(() => {
    // Show loading state when pathname changes
    setIsLoading(true)
    
    // Simulate minimum loading time for better UX
    const timer = setTimeout(() => {
      setIsLoading(false)
      setDisplayChildren(children)
    }, 400) // Slightly longer for better visual feedback

    return () => clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    // Update children when they change (but not during initial load)
    if (!isLoading) {
      setDisplayChildren(children)
    }
  }, [children, isLoading])

  if (isLoading) {
    return (
      <div className="animate-fadeIn">
        {getSkeletonComponent()}
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      {displayChildren}
    </div>
  )
}
