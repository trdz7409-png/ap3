import { NextResponse } from 'next/server'
import { getWorkspace } from '@/lib/workspace'

export async function GET(request: Request) {
  const workspace = await getWorkspace()
  if (!workspace) return NextResponse.redirect(new URL('/auth/login', request.url))
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'Google Ads OAuth is not configured for this deployment.' }, { status: 503 })
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', new URL('/api/google/callback', request.url).toString())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/adwords')
  url.searchParams.set('state', workspace.agency.id)
  return NextResponse.redirect(url)
}
