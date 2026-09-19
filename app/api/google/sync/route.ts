import { NextResponse } from 'next/server'
import { getWorkspace } from '@/lib/workspace'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const workspace = await getWorkspace()
  if (!workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createClient()
  const { data: connection } = await supabase.from('google_connections').select('id').eq('agency_id', workspace.agency.id).maybeSingle()
  if (!connection) return NextResponse.json({ error: 'Connect Google Ads before syncing.' }, { status: 400 })
  return NextResponse.json({ error: 'Google Ads sync is not configured for this deployment.' }, { status: 503 })
}
