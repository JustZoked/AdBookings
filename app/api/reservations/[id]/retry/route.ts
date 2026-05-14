export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyActionToken } from '@/lib/tokens'
import { getCalendarService } from '@/lib/calendar'
import { getMailer } from '@/lib/mailer'
import { graphErrorAdminEmail } from '@/lib/mailer/templates'
import { signActionToken } from '@/lib/tokens'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

const schema = z.object({ token: z.string().min(1) })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const payload = verifyActionToken(parsed.data.token)
  if (!payload || payload.action !== 'retry' || payload.reservationId !== params.id) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const reservation = await db.reservation.findUnique({
    where: { id: params.id },
    include: { room: true },
  })

  if (!reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  if (reservation.status !== 'APPROVED') {
    return NextResponse.json({ error: 'Retry only applicable to APPROVED reservations' }, { status: 400 })
  }

  // Idempotent: if event already exists, nothing to do
  if (reservation.graphEventId && !reservation.graphEventLastError) {
    return NextResponse.json({ success: true, message: 'Calendar event already synced' })
  }

  const calendarService = await getCalendarService()

  const bodyHtml = `
    <p><strong>Reserva confirmada (reintento)</strong></p>
    <p>Salón: ${reservation.room.name}</p>
    <p>Solicitante: ${reservation.requesterName} (${reservation.requesterEmail})</p>
    <p>Actividad: ${reservation.activity}</p>
    <p>Total: $${Number(reservation.calculatedPrice).toFixed(2)}</p>
  `

  try {
    const { eventId } = await calendarService.createBookingEvent({
      roomEmail: reservation.roomEmailSnapshot ?? reservation.room.roomEmail,
      roomName: reservation.room.name,
      requesterEmail: reservation.requesterEmail,
      requesterName: reservation.requesterName,
      activity: reservation.activity,
      startAt: reservation.startAt,
      endAt: reservation.endAt,
      timezone: env.TZ,
      bodyHtml,
    })

    await db.reservation.update({
      where: { id: params.id },
      data: { graphEventId: eventId, graphEventLastError: null },
    })

    return NextResponse.json({ success: true, eventId })
  } catch (err) {
    const error = err as Error
    logger.error({ err: error, reservationId: params.id }, 'Retry createCalendarEvent failed')

    await db.reservation.update({
      where: { id: params.id },
      data: { graphEventLastError: error.message },
    })

    // Re-send error email with new retry token
    const retryToken = signActionToken({ reservationId: params.id, action: 'retry' })
    const retryUrl = `${env.APP_URL}/api/reservations/${params.id}/retry?token=${retryToken}`
    const mailer = await getMailer().catch(() => null)
    if (mailer) {
      const rSummary = {
        id: params.id,
        roomName: reservation.room.name,
        requesterName: reservation.requesterName,
        requesterEmail: reservation.requesterEmail,
        activity: reservation.activity,
        startAt: reservation.startAt,
        endAt: reservation.endAt,
        grandTotal: Number(reservation.calculatedPrice),
      }
      const errMail = graphErrorAdminEmail(rSummary, 'retryCalendarEvent', error.message, retryUrl)
      await mailer.send({ to: env.ADMIN_NOTIFICATION_EMAIL, ...errMail }).catch(() => null)
    }

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
