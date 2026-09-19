import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'
import { getWorkspace } from '@/lib/workspace'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({ email: z.string().email().max(320) })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const workspace = await getWorkspace()
  if (!workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid recipient email.' }, { status: 400 })
  const { id } = await params
  const supabase = await createClient()
  const { data: report } = await supabase.from('reports').select('name,blob_path').eq('id', id).eq('agency_id', workspace.agency.id).eq('status', 'ready').single()
  if (!report || !report.blob_path?.startsWith('data:application/pdf;base64,')) return NextResponse.json({ error: 'Report unavailable.' }, { status: 404 })
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Email delivery is not configured for this deployment.' }, { status: 503 })
  const resend = new Resend(apiKey)
  const result = await resend.emails.send({ from: process.env.REPORT_FROM_EMAIL ?? 'reports@example.com', to: parsed.data.email, subject: report.name, text: 'Your performance report is attached.', attachments: [{ filename: `${report.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`, content: report.blob_path.slice('data:application/pdf;base64,'.length) }] })
  if (result.error) return NextResponse.json({ error: 'Could not send report email.' }, { status: 502 })
  const { error: updateError } = await supabase.from('reports').update({ delivery_status: 'email_sent', email_sent_at: new Date().toISOString() }).eq('id', id).eq('agency_id', workspace.agency.id)
  if (updateError) return NextResponse.json({ error: 'Email sent, but delivery status could not be updated.' }, { status: 502 })
  return NextResponse.json({ sent: true })
}
