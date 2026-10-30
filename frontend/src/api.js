// All backend calls go through here: one place for base URL, JSON and the error format.
const BASE = '/api'

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  // A proxy or gateway error (e.g. 502 while the backend restarts) has an HTML body, not our error format
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const error = data?.error ?? { message: 'Serveren svarer ikke lige nu. Prøv igen om lidt.' }
    throw Object.assign(new Error(error.message), error, { status: res.status })
  }
  return data
}
