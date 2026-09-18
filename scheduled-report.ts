import { get } from '@vercel/blob'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { createReportPdf, type ReportSnapshot } from '@/lib/reports'

export async function scheduledReportDelivery(reportId: string, recipientEmail: string) {
  'use workflow'
  const report = await prepareScheduledReport(reportId)
  await deliverScheduledReport(report, recipientEmail)
  return { delivered: true, reportId }
}

async function prepareScheduledReport(reportId: string) {
  'use step'
  const admin = createAdminClient()
  const { data: report } = await admin.from('reports').select('id,name,snapshot,blob_path,status').eq('id', reportId).single()
  if (!report) throw new Error('Report does not exist.')
  if (!report.blob_path) {
    const bytes = await createReportPdf(report.snapshot as ReportSnapshot)
    const { put } = await import('@vercel/blob')
    const pathname = `reports/scheduled/${report.id}.pdf`
    await put(pathname, Buffer.from(bytes), { access: 'private', contentType: 'application/pdf', addRandomSuffix: false })
    await admin.from('reports').update({ blob_path: pathname, status: 'ready', completed_at: new Date().toISOString() }).eq('id', report.id)
    return { ...report, blob_path: pathname }
  }
  return report
}

async function deliverScheduledReport(report: { id: string; name: string; blob_path: string | null }, recipientEmail: string) {
  'use step'
  if (!report.blob_path) throw new Error('Report PDF is unavailable.')
  const blob = await get(report.blob_path, { access: 'private' })
  if (!blob || blob.statusCode !== 200) throw new Error('Report PDF was not found.')
  const content = Buffer.from(await new Response(blob.stream).arrayBuffer())
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({ from: process.env.REPORT_FROM_EMAIL!, to: [recipientEmail], subject: report.name, html: '<p>Your scheduled Google Ads report is attached.</p><p>— AdPulse Reports</p>', attachments: [{ filename: `${report.name}.pdf`, content }] }, { idempotencyKey: `scheduled-report/${report.id}/${recipientEmail}` })
  if (error) throw new Error(error.message)
}
