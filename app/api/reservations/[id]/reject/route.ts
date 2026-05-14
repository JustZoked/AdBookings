export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyActionToken } from '@/lib/tokens'
import { getCalendarService } from '@/lib/calendar'
import { getMailer } from '@/lib/mailer'
import { rejectedEmail } from '@/lib/mailer/templates'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

const schema = z.object({
  token: z.string().min(1),
  reason: z.string().max(1000).optional(),
})

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
  if (!payload || payload.action !== 'reject' || payload.reservationId !== params.id) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const reservation = await db.reservation.findUnique({
    where: { id: params.id },
    include: { room: true },
  })

  if (!reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  // Idempotent
  if (reservation.status === 'REJECTED') {
    return NextResponse.json({ status: 'REJECTED', alreadyProcessed: true })
  }

  const wasApproved = reservation.status === 'APPROVED'

  const rejected = await db.reservation.update({
    where: { id: params.id },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      adminNotes: parsed.data.reason ?? null,
    },
  })

  // If it was approved, cancel the calendar event
  if (wasApproved && reservation.graphEventId) {
    const calendarService = await getCalendarService().catch(() => null)
    if (calendarService) {
      await calendarService
        .cancelBookingEvent({
          organizerEmail: env.MS_SENDER_EMAIL ?? '',
          eventId: reservation.graphEventId,
          cancellationReason: parsed.data.reason,
        })
        .then(() =>
          db.reservation.update({
            where: { id: params.id },
            data: { graphEventLastError: null },
          })
        )
        .catch(async (err: Error) => {
          logger.error({ err, reservationId: params.id }, 'Failed to cancel calendar event')
          await db.reservation.update({
            where: { id: params.id },
            data: { graphEventLastError: err.message },
          })
        })
    }
  }

  // Notify requester
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
      adminNotes: parsed.data.reason,
    }
    const mail = rejectedEmail(rSummary)
    await mailer
      .send({ to: reservation.requesterEmail, ...mail })
      .catch((err: Error) =>
        logger.error({ err, reservationId: params.id }, 'Failed to send rejection email')
      )
  }

  return NextResponse.json({ status: rejected.status })
}
