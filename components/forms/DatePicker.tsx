'use client'

import { format, subDays, startOfWeek } from 'date-fns'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  error?: string
  disabled?: boolean
}

export function DatePicker({ value, onChange, label = 'Date', error, disabled }: DatePickerProps) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const quickButtons = [
    { label: 'Today', value: today },
    { label: 'Yesterday', value: yesterday },
    { label: 'Week Start', value: weekStart }
  ]

  return (
    <div>
      <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="flex gap-2">
        <input
          id="date"
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          max={today}
          className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
        />
      </div>
      <div className="mt-2 flex gap-2">
        {quickButtons.map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={() => onChange(btn.value)}
            disabled={disabled}
            className="px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {btn.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
