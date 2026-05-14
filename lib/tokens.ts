import { createHmac, timingSafeEqual } from 'crypto'
import { env } from './env'

export type ActionTokenPayload = {
  reservationId: string
  action: 'approve' | 'reject' | 'retry'
  exp: number
}

function base64urlEncode(data: string): string {
  return Buffer.from(data).toString('base64url')
}

function base64urlDecode(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8')
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function signActionToken(
  payload: Omit<ActionTokenPayload, 'exp'>,
  ttlDays: number = env.ACTION_TOKEN_TTL_DAYS
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60
  const fullPayload: ActionTokenPayload = { ...payload, exp }
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload))
  const signature = sign(encodedPayload, env.BOOKING_ACTION_SECRET)
  return `${encodedPayload}.${signature}`
}

export function verifyActionToken(token: string): ActionTokenPayload | null {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return null

    const encodedPayload = token.slice(0, dotIdx)
    const providedSig = token.slice(dotIdx + 1)

    const expectedSig = sign(encodedPayload, env.BOOKING_ACTION_SECRET)

    // Constant-time comparison to prevent timing attacks
    const a = Buffer.from(providedSig, 'base64url')
    const b = Buffer.from(expectedSig, 'base64url')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null

    const payload: ActionTokenPayload = JSON.parse(base64urlDecode(encodedPayload))

    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    if (!payload.reservationId || !payload.action || !payload.exp) return null

    return payload
  } catch {
    return null
  }
}
