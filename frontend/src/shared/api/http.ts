import type { z } from 'zod'
import { appConfig } from '../../app/config'

async function throwApiError(response: Response): Promise<never> {
  const text = await response.text().catch(() => '')
  const data: unknown = text ? parseJson(text) : null
  const message =
    data !== null &&
    typeof data === 'object' &&
    'message' in data &&
    typeof data.message === 'string'
      ? data.message
      : fallbackApiErrorMessage(response.status)

  throw new Error(message)
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function fallbackApiErrorMessage(status: number) {
  if (status === 413) {
    return 'Файл слишком большой. Максимальный размер — 10 МБ.'
  }

  if (status === 415) {
    return 'Можно приложить только картинку, PDF или видео.'
  }

  return `Request failed with status ${status}`
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

export async function apiPostForm<TSchema extends z.ZodType>(
  path: string,
  body: FormData,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const response = await fetch(`${appConfig.VITE_API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    body,
  })

  if (!response.ok) {
    await throwApiError(response)
  }

  return schema.parse(await response.json())
}

export async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${appConfig.VITE_API_BASE_URL}${path}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!response.ok) {
    await throwApiError(response)
  }
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
