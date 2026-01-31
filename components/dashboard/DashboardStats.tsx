'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { formatHours, formatDate } from '@/lib/utils'
import { startOfMonth, startOfWeek } from 'date-fns'

interface Stats {
  qbConnected: boolean
  lastSync: string | null
  pendingReports: number
  monthHours: number
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all stats in parallel
      const [qbStatus, lastSync, pendingReports, monthHours] = await Promise.all([
        fetchQBStatus(),
        fetchLastSync(),
        fetchPendingReports(),
        fetchMonthHours()
      ])

      setStats({
        qbConnected: qbStatus,
        lastSync,
        pendingReports,
        monthHours
      })
    } catch (err) {
      console.error('Error loading stats:', err)
      setError('Failed to load dashboard stats')
    } finally {
      setLoading(false)
    }
  }

  const fetchQBStatus = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('qb_tokens')
        .select('expires_at')
        .single()

      if (error || !data) return false

      return new Date(data.expires_at) > new Date()
    } catch {
      return false
    }
  }

  const fetchLastSync = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('synced_at')
        .not('synced_at', 'is', null)
        .order('synced_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) return null

      return data.synced_at
    } catch {
      return null
    }
  }

  const fetchPendingReports = async (): Promise<number> => {
    try {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
      const weekStartStr = weekStart.toISOString().split('T')[0]

      // Count distinct customers with billable time this week
      const { data, error } = await supabase
        .from('time_entries')
        .select('qb_customer_id')
        .gte('txn_date', weekStartStr)
        .eq('billable_status', 'Billable')

      if (error || !data) return 0

      // Get unique customer count
      const uniqueCustomers = new Set(data.map(entry => entry.qb_customer_id))
      return uniqueCustomers.size
    } catch {
      return 0
    }
  }

  const fetchMonthHours = async (): Promise<number> => {
    try {
      const monthStart = startOfMonth(new Date())
      const monthStartStr = monthStart.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('time_entries')
        .select('hours, minutes')
        .gte('txn_date', monthStartStr)

      if (error || !data) return 0

      const totalHours = data.reduce((sum, entry) => {
        return sum + (entry.hours || 0) + ((entry.minutes || 0) / 60)
      }, 0)

      return Math.round(totalHours * 100) / 100
    } catch {
      return 0
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        {error}
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <p className="text-sm text-gray-600 mb-1">QuickBooks Status</p>
        <p className={`text-2xl font-bold ${stats.qbConnected ? 'text-green-600' : 'text-red-600'}`}>
          {stats.qbConnected ? 'Connected' : 'Disconnected'}
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <p className="text-sm text-gray-600 mb-1">Last Sync</p>
        <p className="text-2xl font-bold text-gray-900">
          {stats.lastSync ? formatDate(stats.lastSync) : '--'}
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <p className="text-sm text-gray-600 mb-1">Pending Reports</p>
        <p className="text-2xl font-bold text-gray-900">
          {stats.pendingReports}
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <p className="text-sm text-gray-600 mb-1">This Month</p>
        <p className="text-2xl font-bold text-gray-900">
          {formatHours(stats.monthHours)}
        </p>
      </div>
    </div>
  )
}
