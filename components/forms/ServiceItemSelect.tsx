'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { formatCurrency } from '@/lib/utils'

interface ServiceItem {
  qb_item_id: string
  name: string
  code: string | null
  unit_price: number
}

interface ServiceItemSelectProps {
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
}

export function ServiceItemSelect({ value, onChange, error, disabled }: ServiceItemSelectProps) {
  const [items, setItems] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadServiceItems()
  }, [])

  const loadServiceItems = async () => {
    try {
      const { data, error } = await supabase
        .from('service_items')
        .select('qb_item_id, name, code, unit_price')
        .eq('is_active', true)
        .order('name')

      if (error) {
        console.error('Error loading service items:', error)
        return
      }

      setItems(data || [])
    } catch (err) {
      console.error('Error in loadServiceItems:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <label htmlFor="service-item" className="block text-sm font-medium text-gray-700 mb-1">
        Service Item <span className="text-red-500">*</span>
      </label>
      <select
        id="service-item"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
      >
        <option value="">
          {loading ? 'Loading service items...' : 'Select a service item'}
        </option>
        {items.map((item) => (
          <option key={item.qb_item_id} value={item.qb_item_id}>
            {item.name}
            {item.code && ` (${item.code})`}
            {' - '}
            {formatCurrency(item.unit_price)}/hr
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
