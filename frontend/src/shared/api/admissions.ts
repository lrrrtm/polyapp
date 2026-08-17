import { z } from 'zod'
import { apiGet, apiPut } from './http'

const lookupValueSchema = z.object({
  id: z.string(),
  name: z.string(),
})

const admissionMatchSchema = z.object({
  program: z.object({
    id: z.number(),
    name: z.string(),
    places: z.number().nullable(),
    education_form: lookupValueSchema,
    admission_condition: lookupValueSchema,
  }),
  priority: z.number().nullable(),
  score: z.number().nullable(),
  current_position: z.number().nullable(),
  agreement_submitted: z.boolean(),
  passes_now: z.boolean(),
})

const applicantCodeProfileSchema = z.object({
  code: z.string(),
  updated_at: z.string(),
})

const applicantAdmissionsSchema = z.object({
  code: z.string(),
  updated_at: z.string(),
  source: z.string(),
  failed_programs: z.number(),
  matches: z.array(admissionMatchSchema),
})

export type ApplicantAdmissions = z.infer<typeof applicantAdmissionsSchema>
export type ApplicantCodeProfile = z.infer<typeof applicantCodeProfileSchema>

export async function setApplicantCode(code: string): Promise<ApplicantCodeProfile> {
  return apiPut('/api/v1/me/applicant-code', { code }, applicantCodeProfileSchema)
}

export async function getMyAdmissions(): Promise<ApplicantAdmissions> {
  return apiGet('/api/v1/me/admissions', applicantAdmissionsSchema)
}
