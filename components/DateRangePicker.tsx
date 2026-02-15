'use client';

import type { DatePresetOption } from '@/lib/datePresets';

interface DateRangePickerProps {
  presets: DatePresetOption[];
  activePreset: string;
  startDate: string;
  endDate: string;
  onPresetChange: (preset: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export function DateRangePicker({
  presets,
  activePreset,
  startDate,
  endDate,
  onPresetChange,
  onStartDateChange,
  onEndDateChange,
}: DateRangePickerProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.key}
            onClick={() => onPresetChange(preset.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activePreset === preset.key
                ? preset.key === 'all_time'
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 text-white'
                : preset.key === 'all_time'
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-3 ml-auto">
        <div>
          <label className="block text-xs text-gray-600 mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
