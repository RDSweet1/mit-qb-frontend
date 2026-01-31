'use client'

import { useState, useEffect } from 'react'
import { Lock, LockOpen, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface UnlockedEntry {
  id: number
  txn_date: string
  employee_name: string
  customer_name: string
  hours: number
  minutes: number
  unlocked_by: string
  unlocked_at: string
  is_locked: boolean
}

export function UnlockAuditLog() {
  const [entries, setEntries] = useState<UnlockedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [lockingId, setLockingId] = useState<number | null>(null)
  const supabase = createClient()

  const loadEntries = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('unlocked_time_entries')
      .select('*')
      .order('unlocked_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error loading unlocked entries:', error)
    } else {
      setEntries(data || [])
    }
    setLoading(false)
  }

  const handleLock = async (entryId: number) => {
    setLockingId(entryId)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.rpc('lock_time_entry', {
      entry_id: entryId,
      user_email: user.email
    })

    if (error) {
      console.error('Error locking entry:', error)
      alert('Failed to lock entry: ' + error.message)
    } else {
      // Update local state
      setEntries(entries.map(e =>
        e.id === entryId ? { ...e, is_locked: true } : e
      ))
    }

    setLockingId(null)
  }

  useEffect(() => {
    loadEntries()
  }, [])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatHours = (hours: number, minutes: number) => {
    const total = hours + minutes / 60
    return total.toFixed(2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <LockOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No unlocked entries found</p>
        <p className="text-sm text-gray-400 mt-1">All time entries are locked and protected</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Unlock Audit Log</h3>
          <p className="text-sm text-gray-500">
            {entries.filter(e => !e.is_locked).length} currently unlocked
            {' · '}
            {entries.length} total unlock events
          </p>
        </div>
        <button
          onClick={loadEntries}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hours
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unlocked By
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unlocked At
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className={entry.is_locked ? 'bg-white' : 'bg-orange-50'}
                >
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatDate(entry.txn_date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {entry.employee_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {entry.customer_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatHours(entry.hours, entry.minutes)} hrs
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {entry.unlocked_by.split('@')[0]}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDateTime(entry.unlocked_at)}
                  </td>
                  <td className="px-4 py-3">
                    {entry.is_locked ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        <Lock className="w-3 h-3" />
                        Locked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                        <LockOpen className="w-3 h-3" />
                        Unlocked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!entry.is_locked && (
                      <button
                        onClick={() => handleLock(entry.id)}
                        disabled={lockingId === entry.id}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50"
                      >
                        {lockingId === entry.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Lock className="w-3 h-3" />
                        )}
                        Lock
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600 pt-2">
        <div>
          Showing {entries.length} unlock events
        </div>
        <div>
          <span className="text-orange-600 font-medium">
            {entries.filter(e => !e.is_locked).length}
          </span>
          {' '}entries currently editable
        </div>
      </div>
    </div>
  )
}
