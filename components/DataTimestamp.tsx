'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataTimestampProps {
  lastUpdated: Date | null
  onRefresh?: () => void
  isRefreshing?: boolean
  className?: string
  /** Auto-refresh interval in ms (0 = disabled). Default: 0. */
  autoRefreshInterval?: number
  /** Minutes before data is considered stale (amber). Default: 15. */
  stalenessWarning?: number
  /** Minutes before data is considered critically stale (red). Default: 30. */
  stalenessCritical?: number
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

export function DataTimestamp({
  lastUpdated,
  onRefresh,
  isRefreshing,
  className,
  autoRefreshInterval = 0,
  stalenessWarning = 15,
  stalenessCritical = 30,
}: DataTimestampProps) {
  const [, setTick] = useState(0)

  // Re-render every 30s to update the "ago" string
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(interval)
  }, [])

  // Auto-refresh when tab is visible
  const stableRefresh = useCallback(() => {
    if (onRefresh && document.visibilityState === 'visible') {
      onRefresh()
    }
  }, [onRefresh])

  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0 || !onRefresh) return

    const interval = setInterval(stableRefresh, autoRefreshInterval)
    return () => clearInterval(interval)
  }, [autoRefreshInterval, stableRefresh, onRefresh])

  if (!lastUpdated) return null

  const minutesOld = (Date.now() - lastUpdated.getTime()) / 60_000
  const isCritical = minutesOld >= stalenessCritical
  const isWarning = minutesOld >= stalenessWarning

  const textColor = isCritical
    ? 'text-red-600 font-semibold'
    : isWarning
    ? 'text-amber-600 font-medium'
    : 'text-gray-500'

  return (
    <div className={cn('flex items-center gap-2 text-xs', textColor, className)}>
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
