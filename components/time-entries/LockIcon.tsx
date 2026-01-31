'use client'

import { Lock, LockOpen } from 'lucide-react'
import { useState } from 'react'

interface LockIconProps {
  isLocked: boolean
  unlockedBy?: string | null
  unlockedAt?: string | null
  onToggle: () => void
  disabled?: boolean
}

export function LockIcon({
  isLocked,
  unlockedBy,
  unlockedAt,
  onToggle,
  disabled = false
}: LockIconProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={onToggle}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={disabled}
        className={`
          p-1.5 rounded-md transition-all
          ${isLocked
            ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
            : 'text-orange-500 hover:text-green-600 hover:bg-green-50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-label={isLocked ? 'Unlock entry' : 'Lock entry'}
      >
        {isLocked ? (
          <Lock className="w-5 h-5" />
        ) : (
          <LockOpen className="w-5 h-5" />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap">
          {isLocked ? (
            <div>
              <div className="font-semibold">🔒 Locked</div>
              <div className="text-gray-300">Click to unlock and edit</div>
            </div>
          ) : (
            <div>
              <div className="font-semibold">🔓 Unlocked</div>
              {unlockedBy && (
                <div className="text-gray-300">
                  by {unlockedBy.split('@')[0]}
                </div>
              )}
              {unlockedAt && (
                <div className="text-gray-400 text-[10px]">
                  {formatDate(unlockedAt)}
                </div>
              )}
              <div className="text-orange-300 mt-1">Click to lock again</div>
            </div>
          )}
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
            <div className="border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  )
}
