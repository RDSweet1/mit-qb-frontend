import { z } from "zod"

export const timeEntrySchema = z.object({
  txn_date: z.string().min(1, "Date is required"),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  hours: z.number().min(0, "Hours must be positive").max(24, "Hours cannot exceed 24"),
  minutes: z.number().min(0, "Minutes must be positive").max(59, "Minutes cannot exceed 59"),
  qb_customer_id: z.string().min(1, "Customer is required"),
  service_item_id: z.string().min(1, "Service item is required"),
  description: z.string().min(1, "Description is required"),
  notes: z.string().optional(),
  billable_status: z.enum(["Billable", "NotBillable"])
}).refine(
  (data) => {
    // Either start/end times OR hours/minutes must be provided
    const hasTime = data.start_time && data.end_time
    const hasDuration = data.hours > 0 || data.minutes > 0
    return hasTime || hasDuration
  },
  {
    message: "Provide either start/end times or hours/minutes",
    path: ["hours"]
  }
)

export const customerSchema = z.object({
  qb_customer_id: z.string().min(1, "QuickBooks Customer ID is required"),
  display_name: z.string().min(1, "Customer name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  net_terms: z.number().min(0).max(365).optional(),
  is_active: z.boolean().default(true)
})

export const serviceItemSchema = z.object({
  qb_item_id: z.string().min(1, "QuickBooks Item ID is required"),
  name: z.string().min(1, "Service name is required"),
  code: z.string().optional(),
  unit_price: z.number().min(0, "Rate must be positive"),
  is_active: z.boolean().default(true)
})

export const clarificationAssignmentSchema = z.object({
  assigneeEmail: z.string().email('Valid email required'),
  assigneeName: z.string().min(1, 'Name is required'),
  assigneeUserId: z.string().optional(),
  question: z.string().min(1, 'Please enter a question'),
  createUserIfMissing: z.boolean(),
})

export type TimeEntryFormData = z.infer<typeof timeEntrySchema>
export type CustomerFormData = z.infer<typeof customerSchema>
export type ServiceItemFormData = z.infer<typeof serviceItemSchema>
export type ClarificationAssignmentData = z.infer<typeof clarificationAssignmentSchema>
