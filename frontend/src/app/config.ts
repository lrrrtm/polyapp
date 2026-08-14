import { z } from 'zod'

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().default(''),
})

export const appConfig = envSchema.parse(import.meta.env)
