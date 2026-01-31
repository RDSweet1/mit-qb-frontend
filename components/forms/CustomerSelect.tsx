'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Customer {
  qb_customer_id: string
  display_name: string
}

interface CustomerSelectProps {
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
}

export function CustomerSelect({ value, onChange, error, disabled }: CustomerSelectProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('qb_customer_id, display_name')
        .eq('is_active', true)
        .order('display_name')

      if (error) {
        console.error('Error loading customers:', error)
        return
      }

      setCustomers(data || [])
    } catch (err) {
      console.error('Error in loadCustomers:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <label htmlFor="customer" className="block text-sm font-medium text-gray-700 mb-1">
        Customer <span className="text-red-500">*</span>
      </label>
      <select
        id="customer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
      >
        <option value="">
          {loading ? 'Loading customers...' : 'Select a customer'}
        </option>
        {customers.map((customer) => (
          <option key={customer.qb_customer_id} value={customer.qb_customer_id}>
            {customer.display_name}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
