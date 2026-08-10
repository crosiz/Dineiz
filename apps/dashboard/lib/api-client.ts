import { authClient } from '@/lib/auth-client'

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const session = await authClient.getSession()
  const token = session?.data?.session?.token

  if (!token) {
    throw new Error('No auth token — user may not be logged in')
  }

  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${path}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value)
    })
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  if (response.status === 401) {
    // Token expired — redirect to login
    window.location.href = '/login'
    throw new Error('Unauthorized — redirecting to login')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `API error: ${response.status}`)
  }

  return response.json()
}

async function requestWithBody<T>(method: string, path: string, body?: any): Promise<T> {
  const session = await authClient.getSession()
  const token = session?.data?.session?.token

  if (!token) {
    throw new Error('No auth token — user may not be logged in')
  }

  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${path}`)

  const response = await fetch(url.toString(), {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('Unauthorized — redirecting to login')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `API error: ${response.status}`)
  }

  return response.json().catch(() => ({})) as Promise<T>;
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  return requestWithBody<T>('POST', path, body)
}

export async function apiPut<T = any>(path: string, body?: any): Promise<T> {
  return requestWithBody<T>('PUT', path, body)
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  return requestWithBody<T>('DELETE', path)
}
