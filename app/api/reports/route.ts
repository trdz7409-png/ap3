import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspace } from '@/lib/workspace'
import { createClient } from '@/lib/supabase/server'
import { createReportPdf, type ReportSnapshot } from '@/lib/reports'

const inputSchema = z.object({ clientId: z.string().uuid(), accountId: z.string().uuid(), start: z.string().date(), end: z.string().date() }).refine(value => value.start <= value.end, { message: 'Invalid date range' })

export async function POST(request: Request) {
  const generatedAt = new Date().toISOString()
  const workspace = await getWorkspace()
  if (!workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = inputSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Choose a client, account, and valid date range.' }, { status: 400 })
  const { clientId, accountId, start, end } = parsed.data
  const supabase = await createClient()
  const [{ data: client }, { data: account }, { data: metrics }] = await Promise.all([
    supabase.from('clients').select('id,name').eq('id', clientId).eq('agency_id', workspace.agency.id).single(),
    supabase.from('ad_accounts').select('id,descriptive_name,currency_code').eq('id', accountId).eq('agency_id', workspace.agency.id).single(),
    supabase.from('campaign_metrics').select('campaign_id,campaign_name,impressions,clicks,cost_micros,conversions').eq('ad_account_id', accountId).eq('agency_id', workspace.agency.id).gte('metric_date', start).lte('metric_date', end),
  ])
  if (!client || !account || !metrics) return NextResponse.json({ error: 'Client, account, or metrics not found.' }, { status: 404 })
  const byCampaign = new Map<string, ReportSnapshot['campaigns'][number]>()
  const snapshot: ReportSnapshot = { agency: workspace.agency.name, client: client.name, period: `${start} — ${end}`, currency: account.currency_code, impressions: 0, clicks: 0, spend: 0, conversions: 0, campaigns: [], source: 'Google Ads', adAccount: account.descriptive_name, reportingPeriodStart: start, reportingPeriodEnd: end, lastSyncedAt: new Date().toISOString(), generatedAt, reportVersion: 1 }
  for (const row of metrics) {
    const impressions = Number(row.impressions), clicks = Number(row.clicks), spend = Number(row.cost_micros) / 1_000_000, conversions = Number(row.conversions)
    snapshot.impressions += impressions; snapshot.clicks += clicks; snapshot.spend += spend; snapshot.conversions += conversions
    const campaign = byCampaign.get(row.campaign_id) ?? { name: row.campaign_name, impressions: 0, clicks: 0, spend: 0, conversions: 0 }
    campaign.impressions += impressions; campaign.clicks += clicks; campaign.spend += spend; campaign.conversions += conversions; byCampaign.set(row.campaign_id, campaign)
  }
  snapshot.campaigns = [...byCampaign.values()]
  const { data: report, error } = await supabase.from('reports').insert({ agency_id: workspace.agency.id, client_id: clientId, ad_account_id: accountId, name: `${client.name} — ${start} to ${end}`, period_start: start, period_end: end, status: 'generating', snapshot, created_by: workspace.user.id }).select('id').single()
  if (error || !report) return NextResponse.json({ error: 'Could not create report.' }, { status: 500 })
  try {
    const pdf = await createReportPdf(snapshot)
    const encoded = Buffer.from(pdf).toString('base64')
    const { error: updateError } = await supabase.from('reports').update({ status: 'ready', blob_path: `data:application/pdf;base64,${encoded}`, completed_at: new Date().toISOString() }).eq('id', report.id).eq('agency_id', workspace.agency.id)
    if (updateError) throw updateError
    return NextResponse.json({ id: report.id, status: 'ready' }, { status: 201 })
  } catch {
    await supabase.from('reports').update({ status: 'failed' }).eq('id', report.id).eq('agency_id', workspace.agency.id)
    return NextResponse.json({ error: 'Could not generate PDF.' }, { status: 500 })
  }
}
