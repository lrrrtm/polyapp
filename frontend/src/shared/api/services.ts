import { z } from 'zod'
import { apiPost } from './http'

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

export type DormitoryPaymentLookup = z.infer<typeof dormitoryPaymentLookupSchema>

export async function lookupDormitoryPayment(contract: string): Promise<DormitoryPaymentLookup> {
  return apiPost('/api/v1/services/dormitory-payment/lookup', { contract }, dormitoryPaymentLookupSchema)
}
