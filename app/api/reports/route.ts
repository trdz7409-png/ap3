import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getWorkspace } from '@/lib/workspace'
import { createReportPdf, type ReportSnapshot } from '@/lib/reports'

const schema = z.object({ clientId: z.string().uuid(), accountId: z.string().uuid(), start: z.string().date(), end: z.string().date() })

export async function POST(request: Request) {
  const workspace = await getWorkspace()
  if (!workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success || parsed.data.start > parsed.data.end) return NextResponse.json({ error: 'Choose a valid reporting period.' }, { status: 400 })
  const supabase = await createClient()
  const [{ data: client }, { data: account }, { data: rows }] = await Promise.all([
    supabase.from('clients').select('id,name').eq('id', parsed.data.clientId).eq('agency_id', workspace.agency.id).single(),
    supabase.from('ad_accounts').select('id,descriptive_name,currency_code,last_synced_at').eq('id', parsed.data.accountId).eq('agency_id', workspace.agency.id).single(),
    supabase.from('campaign_metrics').select('campaign_id,campaign_name,impressions,clicks,cost_micros,conversions').eq('agency_id', workspace.agency.id).eq('ad_account_id', parsed.data.accountId).gte('metric_date', parsed.data.start).lte('metric_date', parsed.data.end),
  ])
  if (!client || !account) return NextResponse.json({ error: 'Client or account not found.' }, { status: 404 })
  const campaigns = new Map<string, ReportSnapshot['campaigns'][number]>()
  let impressions = 0; let clicks = 0; let spend = 0; let conversions = 0
  for (const row of rows ?? []) {
    const item = campaigns.get(row.campaign_id) ?? { name: row.campaign_name, impressions: 0, clicks: 0, spend: 0, conversions: 0 }
    item.impressions += Number(row.impressions); item.clicks += Number(row.clicks); item.spend += Number(row.cost_micros) / 1_000_000; item.conversions += Number(row.conversions)
    impressions += Number(row.impressions); clicks += Number(row.clicks); spend += Number(row.cost_micros) / 1_000_000; conversions += Number(row.conversions); campaigns.set(row.campaign_id, item)
  }
  const generatedAt = new Date().toISOString()
  const snapshot: ReportSnapshot = { agency: workspace.agency.name, client: client.name, period: `${parsed.data.start} — ${parsed.data.end}`, currency: account.currency_code, impressions, clicks, spend, conversions, campaigns: [...campaigns.values()], delivery: { source: 'Google Ads', account: account.descriptive_name, lastSyncedAt: account.last_synced_at ?? null, generatedAt, version: 1 } }
  const bytes = await createReportPdf(snapshot)
  const encoded = `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`
  const { data: report, error } = await supabase.from('reports').insert({ agency_id: workspace.agency.id, client_id: client.id, ad_account_id: account.id, name: `${client.name} — ${parsed.data.start} to ${parsed.data.end}`, period_start: parsed.data.start, period_end: parsed.data.end, status: 'ready', blob_path: encoded, snapshot, source: 'Google Ads', report_version: 1, last_synced_at: account.last_synced_at, created_by: workspace.user.id, completed_at: generatedAt }).select('id').single()
  if (error) return NextResponse.json({ error: 'Could not save the report.' }, { status: 500 })
  return NextResponse.json({ id: report.id })
}
