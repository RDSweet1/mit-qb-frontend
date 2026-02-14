'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataTimestampProps {
  lastUpdated: Date | null
  onRefresh?: () => void
  isRefreshing?: boolean
  className?: string
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function DataTimestamp({ lastUpdated, onRefresh, isRefreshing, className }: DataTimestampProps) {
  const [, setTick] = useState(0)

  // Re-render every 30s to update the "ago" string
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(interval)
  }, [])

  if (!lastUpdated) return null

  return (
    <div className={cn('flex items-center gap-2 text-xs text-gray-500', className)}>
      <span>Updated {timeAgo(lastUpdated)}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          aria-label="Refresh data"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
        </button>
      )}
    </div>
  )
}
