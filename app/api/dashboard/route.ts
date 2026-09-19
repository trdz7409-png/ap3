import { NextResponse } from 'next/server'
import { getWorkspace } from '@/lib/workspace'

export async function GET() {
  const workspace = await getWorkspace()
  if (!workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, agency } = workspace
  const supabase = await (await import('@/lib/supabase/server')).createClient()
  const [clients, accounts, metrics, reports, connection] = await Promise.all([
    supabase.from('clients').select('id,name,email,status').eq('agency_id', agency.id).order('name'),
    supabase.from('ad_accounts').select('id,client_id,descriptive_name,customer_id,currency_code,last_synced_at').eq('agency_id', agency.id).order('descriptive_name'),
    supabase.from('campaign_metrics').select('campaign_id,campaign_name,metric_date,impressions,clicks,cost_micros,conversions').eq('agency_id', agency.id).order('metric_date'),
    supabase.from('reports').select('id,name,status,period_start,period_end,client_id,snapshot,created_at,completed_at').eq('agency_id', agency.id).order('created_at', { ascending: false }),
    supabase.from('google_connections').select('google_email,connected_at').eq('agency_id', agency.id).maybeSingle(),
  ])
  const failure = [clients, accounts, metrics, reports, connection].find(result => result.error)
  if (failure?.error) return NextResponse.json({ error: 'Could not load workspace data.' }, { status: 500 })
  return NextResponse.json({ agency, user: { email: user.email, name: user.user_metadata?.full_name }, clients: clients.data ?? [], accounts: accounts.data ?? [], metrics: metrics.data ?? [], reports: reports.data ?? [], connection: connection.data ?? undefined })
}

export const dynamic = 'force-dynamic'
