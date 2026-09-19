import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspace } from '@/lib/workspace'

export async function GET() {
  const workspace = await getWorkspace()
  if (!workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createClient()
  const [{ data: clients }, { data: accounts }, { data: metrics }, { data: reports }, { data: connection }] = await Promise.all([
    supabase.from('clients').select('id,name,email,status').eq('agency_id', workspace.agency.id).order('name'),
    supabase.from('ad_accounts').select('id,client_id,descriptive_name,customer_id,currency_code,last_synced_at').eq('agency_id', workspace.agency.id).order('descriptive_name'),
    supabase.from('campaign_metrics').select('campaign_id,campaign_name,metric_date,impressions,clicks,cost_micros,conversions').eq('agency_id', workspace.agency.id).order('metric_date'),
    supabase.from('reports').select('id,name,status,period_start,period_end,client_id,ad_account_id,source,report_version,last_synced_at,created_at,delivery_status').eq('agency_id', workspace.agency.id).order('created_at', { ascending: false }),
    supabase.from('google_connections').select('google_email,connected_at').eq('agency_id', workspace.agency.id).maybeSingle(),
  ])
  return NextResponse.json({ agency: workspace.agency, user: { email: workspace.user.email, name: workspace.user.user_metadata.full_name }, clients: clients ?? [], accounts: accounts ?? [], metrics: metrics ?? [], reports: reports ?? [], connection: connection ?? undefined })
}
