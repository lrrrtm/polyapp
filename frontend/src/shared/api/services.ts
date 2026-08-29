import { z } from 'zod'
import { apiGet, apiPost, apiPostForm } from './http'

const dormitoryPaymentPaySchema = z.object({
  name: z.string().nullable(),
  type: z.string().nullable(),
  sum: z.number(),
})

const dormitoryPaymentLookupSchema = z.object({
  valid: z.boolean(),
  contract: z.string().nullable(),
  payer_name: z.string().nullable(),
  base: z.string().nullable(),
  recipient: z.string().nullable(),
  department: z.string().nullable(),
  account: z.string().nullable(),
  additional: z.string().nullable(),
  amount_due: z.number().nullable(),
  pays: z.array(dormitoryPaymentPaySchema),
  data_date: z.string().nullable(),
})

const feedbackSubmissionSchema = z.object({
  id: z.uuid(),
  created_at: z.string(),
})

const academicPeriodSchema = z.object({
  date: z.string(),
  period_type: z.string(),
})

const academicPeriodRangeSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  period_type: z.string(),
})

const currentAcademicCalendarSchema = z.object({
  group_name: z.string(),
  direction_code: z.string(),
  level: z.number(),
  admission_year: z.number(),
  source_url: z.string(),
  current_periods: z.array(academicPeriodSchema),
  next_period: academicPeriodSchema.nullable(),
  periods: z.array(academicPeriodRangeSchema),
})

export type DormitoryPaymentLookup = z.infer<typeof dormitoryPaymentLookupSchema>
export type FeedbackSubject = 'comment' | 'question' | 'bug' | 'feature'
export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>
export type CurrentAcademicCalendar = z.infer<typeof currentAcademicCalendarSchema>

type FeedbackInput = {
  subject: FeedbackSubject
  message: string
  contact: string
  attachment?: File | null
}

export async function lookupDormitoryPayment(contract: string): Promise<DormitoryPaymentLookup> {
  return apiPost('/api/v1/services/dormitory-payment/lookup', { contract }, dormitoryPaymentLookupSchema)
}

export async function submitFeedback(input: FeedbackInput): Promise<FeedbackSubmission> {
  const body = new FormData()
  body.append('subject', input.subject)
  body.append('message', input.message)
  body.append('contact', input.contact)
  if (input.attachment) {
    body.append('attachment', input.attachment)
  }
  return apiPostForm('/api/v1/services/feedback', body, feedbackSubmissionSchema)
}

export async function getCurrentAcademicCalendar(): Promise<CurrentAcademicCalendar> {
  return apiGet('/api/v1/me/academic-calendar/current', currentAcademicCalendarSchema)
}
