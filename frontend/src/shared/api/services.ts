import { z } from 'zod'
import { apiPost, apiPostForm } from './http'

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

export type DormitoryPaymentLookup = z.infer<typeof dormitoryPaymentLookupSchema>
export type FeedbackSubject = 'comment' | 'question' | 'bug' | 'feature'
export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>

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
