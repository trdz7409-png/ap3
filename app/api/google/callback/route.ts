import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptSecret } from '@/lib/encryption'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')
  if (oauthError || !code || !state) return NextResponse.redirect(new URL('/?google=cancelled', request.url))

  try {
    const payload = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { agencyId: string; redirectUri: string }
    if (payload.redirectUri !== `${url.origin}/api/google/callback`) throw new Error('Invalid OAuth redirect.')
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) throw new Error('Google OAuth is not configured.')

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: payload.redirectUri, grant_type: 'authorization_code' }) })
    const tokens = await tokenResponse.json() as { refresh_token?: string; access_token?: string; scope?: string; error?: string }
    if (!tokenResponse.ok || !tokens.refresh_token) throw new Error(tokens.error || 'Google did not return a refresh token.')

    const googleUserResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { authorization: `Bearer ${tokens.access_token}` } })
    const googleUser = googleUserResponse.ok ? await googleUserResponse.json() as { email?: string } : {}
    const encrypted = encryptSecret(tokens.refresh_token)
    const supabase = await createClient()
    const { error } = await supabase.from('google_connections').upsert({ agency_id: payload.agencyId, google_email: googleUser.email ?? null, encrypted_refresh_token: encrypted.encrypted, token_iv: encrypted.iv, token_tag: encrypted.tag, scope: tokens.scope ?? 'https://www.googleapis.com/auth/adwords', updated_at: new Date().toISOString() }, { onConflict: 'agency_id' })
    if (error) throw error
    return NextResponse.redirect(new URL('/?google=connected', request.url))
  } catch (error) {
    console.error('[v0] Google OAuth callback failed:', error)
    return NextResponse.redirect(new URL('/?google=error', request.url))
  }
}
