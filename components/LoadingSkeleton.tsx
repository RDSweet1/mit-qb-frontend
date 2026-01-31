'use client'

import { cn } from '@/lib/utils'

interface LoadingSkeletonProps {
  className?: string
  count?: number
}

export function LoadingSkeleton({ className, count = 1 }: LoadingSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'animate-pulse bg-gray-200 rounded',
            className
          )}
        />
      ))}
    </>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex gap-4">
          <LoadingSkeleton className="h-12 flex-1" />
          <LoadingSkeleton className="h-12 w-32" />
          <LoadingSkeleton className="h-12 w-24" />
        </div>
      ))}
    </div>
  )
}
