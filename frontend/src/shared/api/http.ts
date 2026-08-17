import type { z } from 'zod'
import { appConfig } from '../../app/config'

async function throwApiError(response: Response): Promise<never> {
  const data: unknown = await response.json().catch(() => null)
  const message =
    data !== null &&
    typeof data === 'object' &&
    'message' in data &&
    typeof data.message === 'string'
      ? data.message
      : `Request failed with status ${response.status}`

  throw new Error(message)
}

export async function apiGet<TSchema extends z.ZodType>(
  path: string,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  return apiRequest('GET', path, undefined, schema)
}

export async function apiPut<TSchema extends z.ZodType>(
  path: string,
  body: unknown,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  return apiRequest('PUT', path, body, schema)
}

export async function apiPost<TSchema extends z.ZodType>(
  path: string,
  body: unknown,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  return apiRequest('POST', path, body, schema)
}

async function apiRequest<TSchema extends z.ZodType>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body: unknown,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const response = await fetch(`${appConfig.VITE_API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    ...(method === 'GET'
      ? {}
      : {
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }),
  })

  if (!response.ok) {
    await throwApiError(response)
  }

  return schema.parse(await response.json())
}
