import { NextResponse } from 'next/server'
import { getWorkspace } from '@/lib/workspace'
import { createOAuthState } from '@/lib/google-oauth-state'

export async function GET(request: Request) {
  try {
    const workspace = await getWorkspace()
    if (!workspace) return NextResponse.redirect(new URL('/auth/login', request.url))

    const clientId = process.env.GOOGLE_CLIENT_ID
    const appUrl = process.env.APP_URL
    const redirectUri = appUrl ? `${appUrl.replace(/\/$/, '')}/api/google/callback` : null
    if (!clientId || !redirectUri) return NextResponse.json({ error: 'Google OAuth is not configured.' }, { status: 503 })

    const state = createOAuthState(workspace.user.id, workspace.agency.id)
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: 'https://www.googleapis.com/auth/adwords', state: state.value })
    const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
    response.cookies.set(state.cookie, state.value, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: state.maxAge, path: '/api/google' })
    return response
  } catch (error) {
    console.error('[v0] Google OAuth connect failed:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Google OAuth is not configured.' }, { status: 503 })
  }
}
