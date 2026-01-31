'use client'

import { AlertTriangle, Info, Lock } from 'lucide-react'

interface EditWarningBannerProps {
  unlockedBy?: string | null
  unlockedAt?: string | null
  onLock?: () => void
}

export function EditWarningBanner({
  unlockedBy,
  unlockedAt,
  onLock
}: EditWarningBannerProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div className="mb-4 bg-orange-50 border-l-4 border-orange-500 rounded-r-lg shadow-sm">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />

          <div className="flex-1">
            <h3 className="text-sm font-bold text-orange-900 mb-1">
              ⚠️ This entry is unlocked
            </h3>

            <p className="text-sm text-orange-800 mb-2">
              Changes will <strong>NOT sync back to QuickBooks</strong>. This is a local-only modification.
            </p>

            {unlockedBy && (
              <div className="flex items-center gap-2 text-xs text-orange-700 mb-2">
                <Info className="w-3 h-3" />
                <span>
                  Unlocked by <strong>{unlockedBy.split('@')[0]}</strong>
                  {unlockedAt && ` on ${formatDate(unlockedAt)}`}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={onLock}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-md transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                Lock to Prevent Edits
              </button>

              <p className="text-xs text-orange-700">
                Recommended: Lock again after editing
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
