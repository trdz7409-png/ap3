const API_VERSION = 'v25'
const API_BASE = `https://googleads.googleapis.com/${API_VERSION}`

type AdsError = { error?: { message?: string; status?: string; details?: Array<{ '@type'?: string; errors?: Array<{ errorCode?: Record<string, unknown>; message?: string }> }> } }

export type GoogleAdsAccount = { customerId: string; descriptiveName: string; currencyCode: string; timeZone: string; isManager: boolean }

export function normalizeCustomerId(value: string | undefined | null) {
  const normalized = value?.replace(/\\D/g, '')
  return normalized || undefined
}

export function googleConfig() {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()
  const loginCustomerId = normalizeCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)
  if (!developerToken || developerToken.length < 10 || /test[_-]?123/i.test(developerToken)) throw new GoogleAdsClientError('configuration', 'Google Ads developer token is missing or still a test placeholder.', 503)
  if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID && loginCustomerId?.length !== 10) throw new GoogleAdsClientError('configuration', 'Google Ads login customer ID must contain 10 digits after removing dashes.', 503)
  return { developerToken, loginCustomerId }
}

export class GoogleAdsClientError extends Error {
  constructor(public category: string, message: string, public httpStatus = 502, public requestId?: string) { super(message) }
}

async function parseResponse(response: Response): Promise<AdsError | null> {
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) as AdsError } catch { throw new GoogleAdsClientError('temporary', `Google Ads returned an invalid response (${response.status}).`, response.status) }
}

export async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: refreshToken, client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '', grant_type: 'refresh_token' }) })
  const data = await parseResponse(response) as { access_token?: string; error?: string } | null
  if (!response.ok || !data?.access_token) throw new GoogleAdsClientError('oauth', 'Google authorization expired or was revoked. Reconnect Google Ads.', response.status)
  return data.access_token
}

function classify(status: number, data: AdsError | null, requestId: string | null) {
  const message = data?.error?.message ?? ''
  const details = data?.error?.details?.find(detail => detail['@type']?.includes('GoogleAdsFailure'))
  const code = details?.errors?.[0]?.errorCode ? Object.keys(details.errors[0].errorCode)[0] : data?.error?.status
  if (status === 401) return ['oauth', 'Google authorization expired or was revoked. Reconnect Google Ads.'] as const
  if (status === 429) return ['quota', 'Google Ads rate limit reached. Please try again later.'] as const
  if (status >= 500) return ['temporary', 'Google Ads returned a temporary server error. Please try again.'] as const
  if (status === 403 && /developer|login customer|token/i.test(message)) return ['authorization', 'Google Ads rejected the API access configuration. Verify the approved developer token and Manager Account ID.'] as const
  if (status === 403) return ['access', 'Your Google account does not have access to the selected Google Ads customer.'] as const
  if (status === 404) return ['customer', 'The selected Google Ads customer could not be found.'] as const
  return ['api', `Google Ads request failed (${status})${code ? `: ${code}` : ''}.`] as const
}

export async function adsRequest<T>(path: string, accessToken: string, body?: unknown, loginCustomerId?: string, stream = false) {
  const config = googleConfig()
  const headers: Record<string, string> = { authorization: `Bearer ${accessToken}`, 'developer-token': config.developerToken, accept: 'application/json' }
  if (body) headers['content-type'] = 'application/json'
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId
  const response = await fetch(`${API_BASE}${path}`, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined })
  const requestId = response.headers.get('google-ads-request-id')
  const data = await parseResponse(response)
  if (!response.ok) { const [category, message] = classify(response.status, data, requestId); throw new GoogleAdsClientError(category, message, response.status, requestId ?? undefined) }
  if (!stream) return data as T
  return (data ? [data] : []) as T
}

export async function listAccessibleCustomers(accessToken: string) {
  const data = await adsRequest<{ resourceNames?: string[] }>('/customers:listAccessibleCustomers', accessToken)
  return (data?.resourceNames ?? []).map(resource => normalizeCustomerId(resource.split('/').pop())).filter(Boolean) as string[]
}

export async function searchStream(accessToken: string, customerId: string, query: string, loginCustomerId?: string) {
  const config = googleConfig()
  const headers: Record<string, string> = { authorization: `Bearer ${accessToken}`, 'developer-token': config.developerToken, 'content-type': 'application/json', accept: 'application/json' }
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId
  const response = await fetch(`${API_BASE}/customers/${customerId}/googleAds:searchStream`, { method: 'POST', headers, body: JSON.stringify({ query }) })
  const requestId = response.headers.get('google-ads-request-id')
  const text = await response.text()
  if (!response.ok) { let data: AdsError | null = null; try { data = JSON.parse(text) as AdsError } catch {} ; const [category, message] = classify(response.status, data, requestId); throw new GoogleAdsClientError(category, message, response.status, requestId ?? undefined) }
  return text.split(/\\r?\\n/).filter(Boolean).flatMap(line => { try { return [JSON.parse(line) as Record<string, unknown>] } catch { return [] } }).flatMap(batch => Array.isArray(batch.results) ? batch.results as Array<Record<string, unknown>> : [])
}

export async function discoverAdvertiserAccounts(accessToken: string) {
  const configuredLoginCustomerId = normalizeCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)
  const accessibleIds = await listAccessibleCustomers(accessToken)
  const advertisers = new Map<string, GoogleAdsAccount>()
  for (const accessibleId of accessibleIds) {
    const account = await queryCustomer(accessToken, accessibleId, accessibleId === configuredLoginCustomerId ? undefined : configuredLoginCustomerId).catch(() => null)
    if (!account) continue
    if (!account.isManager) { advertisers.set(account.customerId, account); continue }
    const rows = await searchStream(accessToken, account.customerId, 'SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.manager FROM customer_client WHERE customer_client.level <= 1', account.customerId)
    for (const row of rows) {
      const child = (row as { customerClient?: { id?: string; descriptiveName?: string; currencyCode?: string; timeZone?: string; manager?: boolean } }).customerClient
      if (child?.id && !child.manager) advertisers.set(child.id, { customerId: child.id, descriptiveName: child.descriptiveName ?? `Google Ads ${child.id}`, currencyCode: child.currencyCode ?? 'USD', timeZone: child.timeZone ?? 'UTC', isManager: false })
    }
  }
  return [...advertisers.values()]
}

export async function queryCustomer(accessToken: string, customerId: string, loginCustomerId?: string) {
  const query = 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager FROM customer LIMIT 1'
  const rows = await searchStream(accessToken, customerId, query, loginCustomerId)
  const row = (rows[0] as { customer?: { id?: string; descriptiveName?: string; currencyCode?: string; timeZone?: string; manager?: boolean } } | undefined)?.customer
  if (!row) throw new GoogleAdsClientError('customer', 'Google Ads returned no details for this customer.')
  return { customerId: normalizeCustomerId(row.id) ?? customerId, descriptiveName: row.descriptiveName ?? `Google Ads ${customerId}`, currencyCode: row.currencyCode ?? 'USD', timeZone: row.timeZone ?? 'UTC', isManager: Boolean(row.manager) } satisfies GoogleAdsAccount
}

export function safeGoogleError(error: unknown) { const e = error instanceof GoogleAdsClientError ? error : new GoogleAdsClientError('api', 'Google Ads request failed.') ; return { error: e.message, category: e.category, requestId: e.requestId } }

export { API_VERSION }
