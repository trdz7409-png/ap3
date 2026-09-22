import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspace } from '@/lib/workspace'
import { decryptSecret } from '@/lib/encryption'

const apiBase = 'https://googleads.googleapis.com/v19'

async function readJsonResponse(response: Response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    const contentType = response.headers.get('content-type') ?? 'unknown'
    const preview = text.replace(/\\s+/g, ' ').slice(0, 180)
    throw new Error(`Google returned a non-JSON response (${response.status}, ${contentType}): ${preview}`)
  }
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: refreshToken, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, grant_type: 'refresh_token' }) })
  const data = await readJsonResponse(response) as { access_token?: string; error?: string } | null
  if (!response.ok || !data?.access_token) throw new Error(data?.error || 'Could not refresh Google access token.')
  return data.access_token
}

async function googleRequest<T>(path: string, token: string, body?: unknown) {
  const headers = { authorization: `Bearer ${token}`, 'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!, 'content-type': 'application/json', accept: 'application/json' }
  const response = await fetch(`${apiBase}${path}`, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined })
  const data = await readJsonResponse(response) as { error?: { message?: string } } | null
  if (!response.ok) throw new Error(data?.error?.message || `Google Ads request failed (${response.status}).`)
  return data as T
}

export async function POST() {
  try {
    const workspace = await getWorkspace()
    if (!workspace) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const supabase = await createClient()
    const { data: connection } = await supabase.from('google_connections').select('*').eq('agency_id', workspace.agency.id).maybeSingle()
    if (!connection) return NextResponse.json({ error: 'Connect Google Ads first.' }, { status: 400 })
    const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ADS_DEVELOPER_TOKEN']
    if (required.some(key => !process.env[key])) return NextResponse.json({ error: 'Google Ads server configuration is incomplete.' }, { status: 503 })

    const token = await refreshAccessToken(decryptSecret(connection.encrypted_refresh_token, connection.token_iv, connection.token_tag))
    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, '')
    const accessible = await googleRequest<{ resourceNames?: string[] }>('/customers:listAccessibleCustomers', token)
    const resourceNames = accessible?.resourceNames ?? []
    let synced = 0
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const until = new Date().toISOString().slice(0, 10)

    for (const resourceName of resourceNames) {
      const customerId = resourceName.split('/').pop()
      if (!customerId) continue
      const headersPath = `/customers/${customerId}/googleAds:searchStream`
      const query = `SELECT customer.id, customer.descriptive_name, customer.currency_code, campaign.id, campaign.name, campaign.status, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}'`
      const rows = await googleRequest<Array<{ results?: Array<{ customer?: { descriptiveName?: string; currencyCode?: string }; campaign?: Record<string, unknown>; segments?: Record<string, unknown>; metrics?: Record<string, unknown> }> }>>(headersPath, token, { query, ...(loginCustomerId ? { loginCustomerId } : {}) })
      const { data: account, error: accountError } = await supabase.from('ad_accounts').upsert({ agency_id: workspace.agency.id, customer_id: customerId, descriptive_name: rows?.[0]?.results?.[0]?.customer?.descriptiveName ?? `Google Ads ${customerId}`, currency_code: rows?.[0]?.results?.[0]?.customer?.currencyCode ?? 'USD', last_synced_at: new Date().toISOString(), sync_error: null }, { onConflict: 'agency_id,customer_id' }).select('id').single()
      if (accountError || !account) continue
      const metrics = (rows ?? []).flatMap((batch: { results?: Array<Record<string, unknown>> }) => batch.results ?? [])
      for (const row of metrics) {
        const campaign = row.campaign as { id?: string; name?: string; status?: string } | undefined
        const segments = row.segments as { date?: string } | undefined
        const metric = row.metrics as { impressions?: string; clicks?: string; costMicros?: string; conversions?: number } | undefined
        if (!campaign?.id || !segments?.date) continue
        await supabase.from('campaign_metrics').upsert({ agency_id: workspace.agency.id, ad_account_id: account.id, campaign_id: campaign.id, campaign_name: campaign.name ?? campaign.id, campaign_status: campaign.status ?? 'UNKNOWN', metric_date: segments.date, impressions: Number(metric?.impressions ?? 0), clicks: Number(metric?.clicks ?? 0), cost_micros: Number(metric?.costMicros ?? 0), conversions: Number(metric?.conversions ?? 0), synced_at: new Date().toISOString() }, { onConflict: 'ad_account_id,campaign_id,metric_date' })
        synced++
      }
    }
    return NextResponse.json({ synced })
  } catch (error) {
    console.error('[v0] Google Ads sync failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Google Ads sync failed.' }, { status: 502 })
  }
}
