import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspace } from '@/lib/workspace'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const workspace = await getWorkspace()
  if (!workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = await createClient()
  const { data: report } = await supabase.from('reports').select('name,blob_path').eq('id', id).eq('agency_id', workspace.agency.id).single()
  if (!report?.blob_path) return NextResponse.json({ error: 'Report PDF is unavailable.' }, { status: 404 })
  const match = report.blob_path.match(/^data:application\/pdf;base64,(.+)$/)
  if (!match) return NextResponse.json({ error: 'Report PDF is unavailable.' }, { status: 404 })
  return new Response(Buffer.from(match[1], 'base64'), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${report.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf"`, 'Cache-Control': 'private, no-store' } })
}
