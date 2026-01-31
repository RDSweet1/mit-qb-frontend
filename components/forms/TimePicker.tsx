'use client'

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  label: string
  error?: string
  disabled?: boolean
}

export function TimePicker({ value, onChange, label, error, disabled }: TimePickerProps) {
  return (
    <div>
      <label htmlFor={`time-${label}`} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={`time-${label}`}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
