'use client'

import { cn } from '@/lib/utils'

interface LoadingSkeletonProps {
  variant?: 'table' | 'card' | 'text'
  rows?: number
  columns?: number
  className?: string
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-gray-200 rounded', className)} />
}

function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header row */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonPulse key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="px-4 py-3 border-b border-gray-100 flex gap-4">
          {Array.from({ length: columns }).map((_, col) => (
            <SkeletonPulse
              key={col}
              className={cn('h-4 flex-1', col === 0 && 'max-w-[120px]')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <SkeletonPulse className="h-5 w-2/3 mb-3" />
          <SkeletonPulse className="h-4 w-full mb-2" />
          <SkeletonPulse className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  )
}

function TextSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonPulse
          key={i}
          className={cn('h-4', i === rows - 1 ? 'w-3/5' : 'w-full')}
        />
      ))}
    </div>
  )
}

export function LoadingSkeleton({ variant = 'table', rows, columns, className }: LoadingSkeletonProps) {
  return (
    <div className={cn('w-full', className)} role="status" aria-label="Loading content">
      <span className="sr-only">Loading...</span>
      {variant === 'table' && <TableSkeleton rows={rows} columns={columns} />}
      {variant === 'card' && <CardSkeleton rows={rows} />}
      {variant === 'text' && <TextSkeleton rows={rows} />}
    </div>
  )
}
