import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function createAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const hash = createHash('sha256').update(token).digest('hex')
  const supabase = createAdminClient()
  const { data: share } = await supabase.from('report_shares').select('report_id,expires_at,revoked_at').eq('token_hash', hash).is('revoked_at', null).gt('expires_at', new Date().toISOString()).single()
  if (!share) return NextResponse.json({ error: 'Share link is invalid or expired.' }, { status: 404 })
  const { data: report } = await supabase.from('reports').select('name,period_start,period_end,snapshot').eq('id', share.report_id).single()
  if (!report) return NextResponse.json({ error: 'Report not found.' }, { status: 404 })
  return NextResponse.json({ report })
}
