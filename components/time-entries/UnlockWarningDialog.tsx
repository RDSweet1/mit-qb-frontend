'use client'

import { AlertTriangle, Lock, Unlock } from 'lucide-react'

interface UnlockWarningDialogProps {
  isOpen: boolean
  isLocking: boolean
  entryDetails?: {
    employee_name: string
    txn_date: string
    hours: number
    minutes: number
  }
  onConfirm: () => void
  onCancel: () => void
}

export function UnlockWarningDialog({
  isOpen,
  isLocking,
  entryDetails,
  onConfirm,
  onCancel
}: UnlockWarningDialogProps) {
  if (!isOpen) return null

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatHours = (hours: number, minutes: number) => {
    const total = hours + minutes / 60
    return `${total.toFixed(2)} hours`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isLocking ? 'bg-green-50' : 'bg-orange-50'}`}>
          <div className="flex items-center gap-3">
            {isLocking ? (
              <Lock className="w-6 h-6 text-green-600" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            )}
            <h2 className="text-xl font-bold text-gray-900">
              {isLocking ? 'Lock Time Entry?' : 'Unlock Time Entry?'}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {entryDetails && (
            <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
              <div className="text-sm text-gray-600">
                <div className="font-semibold text-gray-900">
                  {entryDetails.employee_name}
                </div>
                <div>{formatDate(entryDetails.txn_date)}</div>
                <div>{formatHours(entryDetails.hours, entryDetails.minutes)}</div>
              </div>
            </div>
          )}

          {isLocking ? (
            <div className="space-y-3">
              <p className="text-gray-700">
                This will lock the time entry and prevent editing.
              </p>
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">
                  <strong>Protection:</strong> Entry will be read-only and protected from accidental changes.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-700">
                This will allow you to edit this time entry.
              </p>

              <div className="p-4 bg-orange-50 border-l-4 border-orange-500 rounded-md">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-orange-900">
                    <p className="font-bold mb-2">WARNING:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Changes will <strong>NOT</strong> sync back to QuickBooks</li>
                      <li>This creates a local-only modification</li>
                      <li>Next QB sync may overwrite your changes</li>
                      <li>Use only when necessary</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Best Practice:</strong> Make changes in QuickBooks whenever possible.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`
              px-4 py-2 text-white rounded-md transition-colors font-medium
              ${isLocking
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-orange-600 hover:bg-orange-700'
              }
            `}
          >
            {isLocking ? (
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Yes, Lock It
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Unlock className="w-4 h-4" />
                Yes, Unlock It
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
