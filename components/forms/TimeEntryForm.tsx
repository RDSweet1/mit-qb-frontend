'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { timeEntrySchema, TimeEntryFormData } from '@/lib/validations'
import { CustomerSelect } from './CustomerSelect'
import { ServiceItemSelect } from './ServiceItemSelect'
import { DatePicker } from './DatePicker'
import { TimePicker } from './TimePicker'
import { LoadingSpinner } from '../LoadingSpinner'
import { format } from 'date-fns'

interface TimeEntryFormProps {
  initialData?: Partial<TimeEntryFormData>
  onSubmit: (data: TimeEntryFormData) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

export function TimeEntryForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Save'
}: TimeEntryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [startTime, setStartTime] = useState(initialData?.start_time || '')
  const [endTime, setEndTime] = useState(initialData?.end_time || '')

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<TimeEntryFormData>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: initialData || {
      txn_date: format(new Date(), 'yyyy-MM-dd'),
      billable_status: 'Billable',
      hours: 0,
      minutes: 0,
      start_time: '',
      end_time: '',
      description: '',
      notes: ''
    }
  })

  const hours = watch('hours')
  const minutes = watch('minutes')

  // Auto-calculate hours from start/end time
  useEffect(() => {
    if (startTime && endTime) {
      const [startHour, startMin] = startTime.split(':').map(Number)
      const [endHour, endMin] = endTime.split(':').map(Number)

      const startMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin

      let diff = endMinutes - startMinutes
      if (diff < 0) diff += 24 * 60 // Handle overnight

      const calcHours = Math.floor(diff / 60)
      const calcMinutes = diff % 60

      setValue('hours', calcHours)
      setValue('minutes', calcMinutes)
      setValue('start_time', startTime)
      setValue('end_time', endTime)
    }
  }, [startTime, endTime, setValue])

  const onFormSubmit = async (data: TimeEntryFormData) => {
    try {
      setIsSubmitting(true)
      await onSubmit(data)
    } catch (error) {
      console.error('Form submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* Date */}
      <DatePicker
        value={watch('txn_date')}
        onChange={(value) => setValue('txn_date', value)}
        error={errors.txn_date?.message}
        disabled={isSubmitting}
      />

      {/* Time Entry Method */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Option 1: Start/End Time</h4>
          <div className="grid grid-cols-2 gap-2">
            <TimePicker
              value={startTime}
              onChange={setStartTime}
              label="Start Time"
              disabled={isSubmitting}
            />
            <TimePicker
              value={endTime}
              onChange={setEndTime}
              label="End Time"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Option 2: Duration</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="hours" className="block text-sm font-medium text-gray-700 mb-1">
                Hours
              </label>
              <input
                id="hours"
                type="number"
                min="0"
                max="24"
                step="1"
                {...register('hours', { valueAsNumber: true })}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="minutes" className="block text-sm font-medium text-gray-700 mb-1">
                Minutes
              </label>
              <input
                id="minutes"
                type="number"
                min="0"
                max="59"
                step="1"
                {...register('minutes', { valueAsNumber: true })}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {errors.hours && (
        <p className="text-sm text-red-600">{errors.hours.message}</p>
      )}

      {/* Customer */}
      <CustomerSelect
        value={watch('qb_customer_id') || ''}
        onChange={(value) => setValue('qb_customer_id', value)}
        error={errors.qb_customer_id?.message}
        disabled={isSubmitting}
      />

      {/* Service Item */}
      <ServiceItemSelect
        value={watch('service_item_id') || ''}
        onChange={(value) => setValue('service_item_id', value)}
        error={errors.service_item_id?.message}
        disabled={isSubmitting}
      />

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          id="description"
          rows={3}
          {...register('description')}
          disabled={isSubmitting}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.description ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="What work was performed?"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
          Notes (Optional)
        </label>
        <textarea
          id="notes"
          rows={2}
          {...register('notes')}
          disabled={isSubmitting}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Additional notes..."
        />
      </div>

      {/* Billable Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Billable Status <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="Billable"
              {...register('billable_status')}
              disabled={isSubmitting}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Billable</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="NotBillable"
              {...register('billable_status')}
              disabled={isSubmitting}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Non-Billable</span>
          </label>
        </div>
        {errors.billable_status && (
          <p className="mt-1 text-sm text-red-600">{errors.billable_status.message}</p>
        )}
      </div>

      {/* Summary */}
      {(hours > 0 || minutes > 0) && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Total Duration:</strong> {hours}h {minutes}m
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting && <LoadingSpinner size="sm" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
