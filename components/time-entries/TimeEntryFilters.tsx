'use client';

import { ArrowUp, ArrowDown } from 'lucide-react';
import type { DatePreset, Customer } from '@/lib/types';
import { DateRangePicker } from '@/components/DateRangePicker';
import { STANDARD_PRESETS } from '@/lib/datePresets';

interface TimeEntryFiltersProps {
  datePreset: DatePreset;
  startDate: string;
  endDate: string;
  selectedCustomer: string;
  selectedEmployee: string;
  approvalStatusFilter: string;
  sortBy: 'datetime' | 'employee' | 'costcode';
  sortDirection: 'asc' | 'desc';
  customers: Customer[];
  uniqueEmployees: string[];
  onDatePresetChange: (preset: DatePreset) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onCustomerChange: (customer: string) => void;
  onEmployeeChange: (employee: string) => void;
  onApprovalStatusChange: (status: string) => void;
  onSortByChange: (sortBy: 'datetime' | 'employee' | 'costcode') => void;
  onSortDirectionToggle: () => void;
}

export function TimeEntryFilters({
  datePreset,
  startDate,
  endDate,
  selectedCustomer,
  selectedEmployee,
  approvalStatusFilter,
  sortBy,
  sortDirection,
  customers,
  uniqueEmployees,
  onDatePresetChange,
  onStartDateChange,
  onEndDateChange,
  onCustomerChange,
  onEmployeeChange,
  onApprovalStatusChange,
  onSortByChange,
  onSortDirectionToggle,
}: TimeEntryFiltersProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Date Range Picker */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
          <DateRangePicker
            presets={STANDARD_PRESETS}
            activePreset={datePreset}
            startDate={startDate}
            endDate={endDate}
            onPresetChange={(p) => onDatePresetChange(p as DatePreset)}
            onStartDateChange={onStartDateChange}
            onEndDateChange={onEndDateChange}
          />
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
            <select
              value={selectedCustomer}
              onChange={(e) => onCustomerChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Customers</option>
              {customers.map(customer => (
                <option key={customer.qb_customer_id} value={customer.qb_customer_id}>
                  {customer.display_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
            <select
              value={selectedEmployee}
              onChange={(e) => onEmployeeChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Employees</option>
              {uniqueEmployees.map(employee => (
                <option key={employee} value={employee}>{employee}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Approval Status</label>
            <select
              value={approvalStatusFilter}
              onChange={(e) => onApprovalStatusChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="not_sent">Not Sent (Pending + Approved)</option>
              <option value="edited">Edited / Changed</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="read">Read</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <div className="flex gap-2">
              {[
                { value: 'datetime' as const, label: 'Date/Time' },
                { value: 'employee' as const, label: 'Employee' },
                { value: 'costcode' as const, label: 'Cost Code' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => onSortByChange(option.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sortBy === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                onClick={onSortDirectionToggle}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-1"
                title={sortDirection === 'asc' ? 'Oldest to Newest' : 'Newest to Oldest'}
              >
                {sortDirection === 'asc' ? (
                  <>
                    <ArrowUp className="w-4 h-4" />
                    <span className="hidden sm:inline">Old&rarr;New</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-4 h-4" />
                    <span className="hidden sm:inline">New&rarr;Old</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
