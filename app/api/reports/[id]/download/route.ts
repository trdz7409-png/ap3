import { NextResponse } from 'next/server'
import { getWorkspace } from '@/lib/workspace'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const workspace = await getWorkspace()
  if (!workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = await createClient()
  const { data: report } = await supabase.from('reports').select('name,blob_path,status').eq('id', id).eq('agency_id', workspace.agency.id).single()
  if (!report || report.status !== 'ready' || !report.blob_path?.startsWith('data:application/pdf;base64,')) return NextResponse.json({ error: 'Report unavailable.' }, { status: 404 })
  const bytes = Buffer.from(report.blob_path.slice('data:application/pdf;base64,'.length), 'base64')
  return new NextResponse(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${report.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf"`, 'Cache-Control': 'private, no-store' } })
}
