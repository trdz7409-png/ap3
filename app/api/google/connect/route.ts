import { NextResponse } from 'next/server'
import { getWorkspace } from '@/lib/workspace'

export async function GET(request: Request) {
  const workspace = await getWorkspace()
  if (!workspace) return NextResponse.redirect(new URL('/auth/login', request.url))

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = `${new URL(request.url).origin}/api/google/callback`
  if (!clientId) return NextResponse.json({ error: 'Google OAuth is not configured.' }, { status: 503 })

  const state = Buffer.from(JSON.stringify({ agencyId: workspace.agency.id, redirectUri })).toString('base64url')
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: 'https://www.googleapis.com/auth/adwords', state })
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
