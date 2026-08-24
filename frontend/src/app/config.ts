import { z } from 'zod'

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().default(''),
  VITE_ADMISSIONS_ENABLED: z.string().default('true').transform((value) => value !== 'false'),
})

export const appConfig = envSchema.parse(import.meta.env)
