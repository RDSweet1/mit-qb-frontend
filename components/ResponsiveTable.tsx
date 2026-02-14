'use client'

import { cn } from '@/lib/utils'

interface ResponsiveTableProps {
  children: React.ReactNode
  className?: string
}

/**
 * Wrapper for data tables that enables horizontal scrolling on narrow viewports.
 * Apply around any <table> or table-like structure.
 */
export function ResponsiveTable({ children, className }: ResponsiveTableProps) {
  return (
    <div className={cn('w-full overflow-x-auto -mx-px', className)}>
      <div className="min-w-full inline-block align-middle">
        {children}
      </div>
    </div>
  )
}
