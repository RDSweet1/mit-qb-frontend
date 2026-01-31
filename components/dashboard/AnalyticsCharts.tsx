'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { startOfMonth, subDays, format } from 'date-fns'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'

interface CustomerHours {
  customer: string
  hours: number
}

interface BillableData {
  name: string
  value: number
  percentage: number
}

interface DailyHours {
  date: string
  hours: number
}

interface ServiceHours {
  service: string
  hours: number
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export function AnalyticsCharts() {
  const [customerData, setCustomerData] = useState<CustomerHours[]>([])
  const [billableData, setBillableData] = useState<BillableData[]>([])
  const [dailyData, setDailyData] = useState<DailyHours[]>([])
  const [serviceData, setServiceData] = useState<ServiceHours[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChartData()
  }, [])

  const loadChartData = async () => {
    try {
      setLoading(true)

      await Promise.all([
        loadCustomerHours(),
        loadBillableBreakdown(),
        loadDailyTrend(),
        loadServiceBreakdown()
      ])
    } catch (err) {
      console.error('Error loading chart data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadCustomerHours = async () => {
    try {
      const monthStart = startOfMonth(new Date()).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('time_entries')
        .select('qb_customer_id, hours, minutes, customers(display_name)')
        .gte('txn_date', monthStart)

      if (error || !data) {
        console.error('Error loading customer hours:', error)
        return
      }

      // Group by customer and sum hours
      const grouped = data.reduce((acc: any, entry: any) => {
        const customerId = entry.qb_customer_id
        const customerName = entry.customers?.display_name || customerId
        const hours = (entry.hours || 0) + ((entry.minutes || 0) / 60)

        if (!acc[customerId]) {
          acc[customerId] = { customer: customerName, hours: 0 }
        }
        acc[customerId].hours += hours

        return acc
      }, {})

      // Convert to array and sort by hours (descending), take top 5
      const chartData = Object.values(grouped)
        .sort((a: any, b: any) => b.hours - a.hours)
        .slice(0, 5)
        .map((item: any) => ({
          customer: item.customer,
          hours: Math.round(item.hours * 100) / 100
        }))

      setCustomerData(chartData as CustomerHours[])
    } catch (err) {
      console.error('Error in loadCustomerHours:', err)
    }
  }

  const loadBillableBreakdown = async () => {
    try {
      const monthStart = startOfMonth(new Date()).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('time_entries')
        .select('billable_status, hours, minutes')
        .gte('txn_date', monthStart)

      if (error || !data) return

      const billable = data
        .filter(e => e.billable_status === 'Billable')
        .reduce((sum, e) => sum + (e.hours || 0) + ((e.minutes || 0) / 60), 0)

      const nonBillable = data
        .filter(e => e.billable_status === 'NotBillable')
        .reduce((sum, e) => sum + (e.hours || 0) + ((e.minutes || 0) / 60), 0)

      const total = billable + nonBillable

      if (total > 0) {
        setBillableData([
          {
            name: 'Billable',
            value: Math.round(billable * 100) / 100,
            percentage: Math.round((billable / total) * 100)
          },
          {
            name: 'Non-Billable',
            value: Math.round(nonBillable * 100) / 100,
            percentage: Math.round((nonBillable / total) * 100)
          }
        ])
      }
    } catch (err) {
      console.error('Error in loadBillableBreakdown:', err)
    }
  }

  const loadDailyTrend = async () => {
    try {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('time_entries')
        .select('txn_date, hours, minutes')
        .gte('txn_date', thirtyDaysAgo)
        .order('txn_date', { ascending: true })

      if (error || !data) return

      // Group by date
      const grouped = data.reduce((acc: any, entry) => {
        const date = entry.txn_date
        const hours = (entry.hours || 0) + ((entry.minutes || 0) / 60)

        if (!acc[date]) {
          acc[date] = 0
        }
        acc[date] += hours

        return acc
      }, {})

      // Convert to array and format
      const chartData = Object.entries(grouped).map(([date, hours]) => ({
        date: format(new Date(date), 'MMM dd'),
        hours: Math.round((hours as number) * 100) / 100
      }))

      setDailyData(chartData as DailyHours[])
    } catch (err) {
      console.error('Error in loadDailyTrend:', err)
    }
  }

  const loadServiceBreakdown = async () => {
    try {
      const monthStart = startOfMonth(new Date()).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('time_entries')
        .select('service_item_id, hours, minutes, service_items(name)')
        .gte('txn_date', monthStart)

      if (error || !data) return

      // Group by service
      const grouped = data.reduce((acc: any, entry: any) => {
        const serviceId = entry.service_item_id
        const serviceName = entry.service_items?.name || serviceId
        const hours = (entry.hours || 0) + ((entry.minutes || 0) / 60)

        if (!acc[serviceId]) {
          acc[serviceId] = { service: serviceName, hours: 0 }
        }
        acc[serviceId].hours += hours

        return acc
      }, {})

      // Convert to array and sort
      const chartData = Object.values(grouped)
        .sort((a: any, b: any) => b.hours - a.hours)
        .slice(0, 5)
        .map((item: any) => ({
          service: item.service,
          hours: Math.round(item.hours * 100) / 100
        }))

      setServiceData(chartData as ServiceHours[])
    } catch (err) {
      console.error('Error in loadServiceBreakdown:', err)
    }
  }

  if (loading) {
    return (
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-64 bg-gray-100 rounded"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold text-gray-900 mb-6">Analytics</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hours by Customer */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Top Customers (This Month)</h4>
          {customerData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={customerData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="customer" />
                <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Bar dataKey="hours" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* Billable vs Non-Billable */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Billable vs Non-Billable</h4>
          {billableData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={billableData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.name}: ${entry.percentage}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {billableData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* Daily Hours Trend */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Daily Hours (Last 30 Days)</h4>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Line type="monotone" dataKey="hours" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* Hours by Service Type */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Top Services (This Month)</h4>
          {serviceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={serviceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="service" />
                <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Bar dataKey="hours" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
