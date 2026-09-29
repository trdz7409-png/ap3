import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspace } from '@/lib/workspace'
import { decryptSecret } from '@/lib/encryption'
import { discoverAdvertiserAccounts, refreshAccessToken, safeGoogleError, normalizeCustomerId, searchStream } from '@/lib/google-ads'

export async function POST(request: Request) {
  try {
    const workspace = await getWorkspace()
    if (!workspace) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const supabase = await createClient()
    const { data: connection } = await supabase.from('google_connections').select('*').eq('agency_id', workspace.agency.id).maybeSingle()
    if (!connection) return NextResponse.json({ error: 'Connect Google Ads first.' }, { status: 400 })
    const token = await refreshAccessToken(decryptSecret(connection.encrypted_refresh_token, connection.token_iv, connection.token_tag))
    const body = await request.json().catch(() => ({})) as { customerId?: string }
    const requestedCustomerId = normalizeCustomerId(body.customerId)
    const configuredLoginCustomerId = normalizeCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)
    const discoveredAccounts = await discoverAdvertiserAccounts(token)
    const selectedAccounts = requestedCustomerId ? discoveredAccounts.filter(account => account.customerId === requestedCustomerId) : discoveredAccounts
    if (!selectedAccounts.length) return NextResponse.json({ error: 'No accessible Google Ads advertiser account was found. Check that the login customer ID is the manager account that owns this customer.', category: 'access' }, { status: 403 })
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const until = new Date().toISOString().slice(0, 10)
    let synced = 0
    const checkedAccounts: string[] = []
    for (const account of selectedAccounts) {
      const customerId = account.customerId
      if (account.isManager) continue
      checkedAccounts.push(account.customerId)
      const query = `SELECT customer.id, customer.descriptive_name, customer.currency_code, campaign.id, campaign.name, campaign.status, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}'`
      const rows = await searchStream(token, account.customerId, query, configuredLoginCustomerId)
      const first = rows[0] as { customer?: { descriptiveName?: string; currencyCode?: string }; } | undefined
      const { data: adAccount, error: accountError } = await supabase.from('ad_accounts').upsert({ agency_id: workspace.agency.id, customer_id: account.customerId, descriptive_name: first?.customer?.descriptiveName ?? account.descriptiveName, currency_code: first?.customer?.currencyCode ?? account.currencyCode, timezone: account.timeZone, last_synced_at: new Date().toISOString(), sync_error: null }, { onConflict: 'agency_id,customer_id' }).select('id').single()
      if (accountError || !adAccount) throw accountError ?? new Error('Could not save Google Ads account.')
      for (const row of rows) {
        const campaign = row.campaign as { id?: string; name?: string; status?: string } | undefined
        const segments = row.segments as { date?: string } | undefined
        const metrics = row.metrics as { impressions?: string | number; clicks?: string | number; costMicros?: string | number; conversions?: string | number } | undefined
        if (!campaign?.id || !segments?.date) continue
        const { error } = await supabase.from('campaign_metrics').upsert({ agency_id: workspace.agency.id, ad_account_id: adAccount.id, campaign_id: campaign.id, campaign_name: campaign.name ?? campaign.id, campaign_status: campaign.status ?? 'UNKNOWN', metric_date: segments.date, impressions: Number(metrics?.impressions ?? 0), clicks: Number(metrics?.clicks ?? 0), cost_micros: Number(metrics?.costMicros ?? 0), conversions: Number(metrics?.conversions ?? 0), synced_at: new Date().toISOString() }, { onConflict: 'ad_account_id,campaign_id,metric_date' })
        if (error) throw error
        synced++
      }
    }
    return NextResponse.json({ synced, accounts: checkedAccounts })
  } catch (error) {
    const result = safeGoogleError(error)
    console.error('[v0] Google Ads sync failed:', { category: result.category, requestId: result.requestId, message: result.error })
    const status = error instanceof Error && 'httpStatus' in error ? Number((error as { httpStatus?: number }).httpStatus) || 502 : 502
    return NextResponse.json(result, { status })
  }
}
