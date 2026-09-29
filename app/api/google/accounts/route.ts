import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspace } from '@/lib/workspace'
import { decryptSecret } from '@/lib/encryption'
import { discoverAdvertiserAccounts, refreshAccessToken, safeGoogleError } from '@/lib/google-ads'

export async function GET() {
  try {
    const workspace = await getWorkspace()
    if (!workspace) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const supabase = await createClient()
    const { data: connection } = await supabase.from('google_connections').select('*').eq('agency_id', workspace.agency.id).maybeSingle()
    if (!connection) return NextResponse.json({ error: 'Connect Google Ads first.' }, { status: 400 })
    const token = await refreshAccessToken(decryptSecret(connection.encrypted_refresh_token, connection.token_iv, connection.token_tag))
    const accounts = await discoverAdvertiserAccounts(token)
    for (const account of accounts) {
      await supabase.from('ad_accounts').upsert({ agency_id: workspace.agency.id, customer_id: account!.customerId, descriptive_name: account!.descriptiveName, currency_code: account!.currencyCode, timezone: account!.timeZone, status: account!.isManager ? 'manager' : 'enabled', last_synced_at: new Date().toISOString(), sync_error: null }, { onConflict: 'agency_id,customer_id' })
    }
    return NextResponse.json({ accounts })
  } catch (error) {
    const result = safeGoogleError(error)
    console.error('[v0] Google account discovery failed:', { category: result.category, requestId: result.requestId, message: result.error })
    return NextResponse.json(result, { status: error instanceof Error && 'httpStatus' in error ? Number((error as { httpStatus?: number }).httpStatus) || 502 : 502 })
  }
}
