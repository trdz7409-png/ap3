import crypto from 'node:crypto'

const stateCookie = 'google_oauth_state'
const ttlMs = 10 * 60 * 1000

type OAuthState = { nonce: string; userId: string; agencyId: string; expiresAt: number }

function secret() {
  const value = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
  if (!value) throw new Error('Google OAuth state secret is not configured.')
  return value
}

function sign(value: string) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url')
}

export function createOAuthState(userId: string, agencyId: string) {
  const payload: OAuthState = { nonce: crypto.randomBytes(32).toString('base64url'), userId, agencyId, expiresAt: Date.now() + ttlMs }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return { value: `${encoded}.${sign(encoded)}`, cookie: stateCookie, maxAge: Math.floor(ttlMs / 1000) }
}

function readSignedState(value: string | undefined) {
  if (!value) return null
  const [encoded, signature] = value.split('.')
  const expected = encoded ? sign(encoded) : ''
  if (!encoded || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OAuthState
  return payload.expiresAt >= Date.now() ? payload : null
}

export function verifyOAuthState(value: string | undefined, expectedUserId: string, expectedAgencyId: string) {
  const payload = readSignedState(value)
  if (!payload || payload.userId !== expectedUserId || payload.agencyId !== expectedAgencyId) return null
  return payload
}

export function getOAuthStateClaims(value: string | undefined) {
  return readSignedState(value)
}

export { stateCookie }
