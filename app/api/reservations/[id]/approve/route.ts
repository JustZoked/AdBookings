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
  if (!payload || payload.action !== 'approve' || payload.reservationId !== params.id) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const reservation = await db.reservation.findUnique({
    where: { id: params.id },
    include: { room: true },
  })

  if (!reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  // Idempotent: already processed
  if (reservation.status !== 'PENDING') {
    return NextResponse.json({ status: reservation.status, alreadyProcessed: true })
  }

  // Mark as approved
  const approved = await db.reservation.update({
    where: { id: params.id },
    data: { status: 'APPROVED', approvedAt: new Date() },
  })

  // Create calendar event
  const calendarService = await getCalendarService().catch((err) => {
    logger.error({ err }, 'Failed to init calendar service')
    return null
  })

  if (calendarService) {
    const bodyHtml = `
      <p><strong>Reserva confirmada</strong></p>
      <p>Salón: ${reservation.room.name}</p>
      <p>Solicitante: ${reservation.requesterName} (${reservation.requesterEmail})</p>
      <p>Actividad: ${reservation.activity}</p>
      <p>Total: $${Number(reservation.calculatedPrice).toFixed(2)}</p>
    `

    await calendarService
      .createBookingEvent({
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
      .then(async ({ eventId }) => {
        await db.reservation.update({
          where: { id: params.id },
          data: { graphEventId: eventId, graphEventLastError: null },
        })
      })
      .catch(async (err: Error) => {
        logger.error({ err, reservationId: params.id }, 'Failed to create calendar event')
        await db.reservation.update({
          where: { id: params.id },
          data: { graphEventLastError: err.message },
        })

        // Notify admin with retry link
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
          const errMail = graphErrorAdminEmail(rSummary, 'createCalendarEvent', err.message, retryUrl)
          await mailer.send({ to: env.ADMIN_NOTIFICATION_EMAIL, ...errMail }).catch((e: Error) =>
            logger.error({ e }, 'Failed to send graph error email')
          )
        }
      })
  }

  return NextResponse.json({ status: approved.status })
}
