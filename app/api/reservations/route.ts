import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { calculatePrice } from '@/lib/pricing'
import { isSlotAvailable } from '@/lib/availability'
import { signActionToken } from '@/lib/tokens'
import { getMailer } from '@/lib/mailer'
import { pendingConfirmationEmail, newReservationAdminEmail } from '@/lib/mailer/templates'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { addHours } from 'date-fns'

const schema = z.object({
  roomId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  requesterName: z.string().min(2).max(100),
  requesterEmail: z.string().email(),
  activity: z.string().min(3).max(500),
  amenityIds: z.array(z.string()).optional().default([]),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { roomId, startAt: startStr, endAt: endStr, requesterName, requesterEmail, activity, amenityIds } = parsed.data
  const startAt = new Date(startStr)
  const endAt = new Date(endStr)

  if (endAt <= startAt) {
    return NextResponse.json({ error: 'endAt must be after startAt' }, { status: 400 })
  }

  const room = await db.room.findUnique({
    where: { id: roomId },
    include: { amenities: true },
  })

  if (!room || !room.isActive) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  // Enforce minimum advance booking
  const minStart = addHours(new Date(), room.minAdvanceHours)
  if (startAt < minStart) {
    return NextResponse.json(
      { error: `Reservations require at least ${room.minAdvanceHours} hours advance notice` },
      { status: 400 }
    )
  }

  // Check availability
  const available = await isSlotAvailable(db, roomId, startAt, endAt, env.BOOKING_BUFFER_MINUTES)
  if (!available) {
    return NextResponse.json({ error: 'This time slot is not available' }, { status: 409 })
  }

  // Calculate price
  const selectedAmenities = room.amenities
    .filter((a) => amenityIds.includes(a.id))
    .map((a) => ({ id: a.id, label: a.label, price: Number(a.price) }))

  const breakdown = calculatePrice(
    startAt,
    endAt,
    {
      basePricePerHour: Number(room.basePricePerHour),
      nightSurchargeStartHour: env.NIGHT_SURCHARGE_START_HOUR,
      nightSurchargePercent: env.NIGHT_SURCHARGE_PERCENT,
      weekendSurchargePercent: env.WEEKEND_SURCHARGE_PERCENT,
      timezone: env.TZ,
    },
    selectedAmenities
  )

  // Create reservation
  const reservation = await db.reservation.create({
    data: {
      roomId,
      startAt,
      endAt,
      requesterName,
      requesterEmail,
      activity,
      calculatedPrice: breakdown.grandTotal,
      priceBreakdown: breakdown as object,
      selectedAmenityIds: amenityIds,
      roomEmailSnapshot: room.roomEmail,
      status: 'PENDING',
    },
  })

  // Send emails (non-blocking, errors logged)
  const approveToken = signActionToken({ reservationId: reservation.id, action: 'approve' })
  const rejectToken = signActionToken({ reservationId: reservation.id, action: 'reject' })
  const approveUrl = `${env.APP_URL}/action/approve?token=${approveToken}`
  const rejectUrl = `${env.APP_URL}/action/reject?token=${rejectToken}`

  const rSummary = {
    id: reservation.id,
    roomName: room.name,
    requesterName,
    requesterEmail,
    activity,
    startAt,
    endAt,
    grandTotal: breakdown.grandTotal,
  }

  const mailer = await getMailer().catch((err) => {
    logger.error({ err }, 'Failed to init mailer')
    return null
  })

  if (mailer) {
    // Email to requester
    const requesterMail = pendingConfirmationEmail(rSummary)
    await mailer
      .send({ to: requesterEmail, ...requesterMail })
      .then(() =>
        db.reservation.update({ where: { id: reservation.id }, data: { emailSent: true } })
      )
      .catch(async (err: Error) => {
        logger.error({ err, reservationId: reservation.id }, 'Failed to send requester email')
        await db.reservation.update({
          where: { id: reservation.id },
          data: { emailLastError: err.message },
        })
      })

    // Email to admin
    const adminMail = newReservationAdminEmail(rSummary, approveUrl, rejectUrl)
    await mailer
      .send({ to: env.ADMIN_NOTIFICATION_EMAIL, ...adminMail })
      .catch((err: Error) =>
        logger.error({ err, reservationId: reservation.id }, 'Failed to send admin email')
      )
  }

  return NextResponse.json({ id: reservation.id }, { status: 201 })
}
