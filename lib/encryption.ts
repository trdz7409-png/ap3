import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

function key() {
  return createHash('sha256').update(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY!).digest()
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return { encrypted: encrypted.toString('base64url'), iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') }
}

export function decryptSecret(value: string, iv: string, tag: string) {
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(value, 'base64url')), decipher.final()]).toString('utf8')
}
