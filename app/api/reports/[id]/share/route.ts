import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getWorkspace } from '@/lib/workspace'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const workspace = await getWorkspace()
  if (!workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = await createClient()
  const { data: report } = await supabase.from('reports').select('id').eq('id', id).eq('agency_id', workspace.agency.id).single()
  if (!report) return NextResponse.json({ error: 'Report not found.' }, { status: 404 })
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase.from('report_shares').insert({ report_id: id, agency_id: workspace.agency.id, token_hash: tokenHash, expires_at: expiresAt })
  if (error) return NextResponse.json({ error: 'Could not create share link.' }, { status: 500 })
  return NextResponse.json({ url: new URL(`/share/${token}`, request.url).toString(), expiresAt })
}
