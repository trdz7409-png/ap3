import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { encryptSecret } from '@/lib/encryption'
import { getOAuthStateClaims, stateCookie, verifyOAuthState } from '@/lib/google-oauth-state'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')
  if (oauthError || !code || !state) return NextResponse.redirect(new URL('/?google=cancelled', request.url))

  try {
    const appUrl = process.env.APP_URL
    const redirectUri = appUrl ? `${appUrl.replace(/\/$/, '')}/api/google/callback` : null
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const storedState = (await cookies()).get(stateCookie)?.value
    const claims = getOAuthStateClaims(state)
    if (!user || !claims || storedState !== state || !redirectUri) throw new Error('Invalid or expired OAuth state.')
    const { data: membership } = await supabase.from('agency_members').select('agency_id').eq('agency_id', claims.agencyId).eq('user_id', user.id).maybeSingle()
    const oauthState = verifyOAuthState(state, user.id, membership?.agency_id ?? '')
    if (!oauthState) throw new Error('Invalid or expired OAuth state.')
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) throw new Error('Google OAuth is not configured.')

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }) })
    const tokens = await tokenResponse.json() as { refresh_token?: string; access_token?: string; scope?: string; error?: string }
    if (!tokenResponse.ok || !tokens.refresh_token) throw new Error(tokens.error || 'Google did not return a refresh token.')

    const googleUserResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { authorization: `Bearer ${tokens.access_token}` } })
    const googleUser = googleUserResponse.ok ? await googleUserResponse.json() as { email?: string } : {}
    const encrypted = encryptSecret(tokens.refresh_token)
    const { error } = await supabase.from('google_connections').upsert({ agency_id: oauthState.agencyId, google_email: googleUser.email ?? null, encrypted_refresh_token: encrypted.encrypted, token_iv: encrypted.iv, token_tag: encrypted.tag, scope: tokens.scope ?? 'https://www.googleapis.com/auth/adwords', updated_at: new Date().toISOString() }, { onConflict: 'agency_id' })
    if (error) throw error
    const response = NextResponse.redirect(new URL('/?google=connected', request.url))
    response.cookies.delete(stateCookie)
    return response
  } catch (error) {
    console.error('[v0] Google OAuth callback failed:', error)
    return NextResponse.redirect(new URL('/?google=error', request.url))
  }
}
