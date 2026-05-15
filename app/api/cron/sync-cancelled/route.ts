export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { getCalendarService } from '@/lib/calendar'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find all APPROVED reservations that have a calendar event
  const approved = await db.reservation.findMany({
    where: {
      status: 'APPROVED',
      graphEventId: { not: null },
      // Only check future or recent reservations (no point checking old ones)
      endAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    include: { room: true },
  })

  if (approved.length === 0) {
    return NextResponse.json({ checked: 0, cancelled: 0 })
  }

  let calendarService: Awaited<ReturnType<typeof getCalendarService>> | null = null
  try {
    calendarService = await getCalendarService()
  } catch {
    return NextResponse.json({ error: 'Calendar service unavailable' }, { status: 503 })
  }

  const token = await (calendarService as any).getToken()
  const senderEmail = env.MS_SENDER_EMAIL!

  let cancelled = 0
  const errors: string[] = []

  for (const reservation of approved) {
    try {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/events/${reservation.graphEventId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.status === 404) {
        // Event was deleted in Exchange — cancel the reservation
        await db.reservation.update({
          where: { id: reservation.id },
          data: { status: 'CANCELLED' },
        })
        cancelled++
        logger.info(
          { reservationId: reservation.id, roomName: reservation.room.name },
          'Reservation auto-cancelled: calendar event no longer exists'
        )
      }
    } catch (err) {
      errors.push(`${reservation.id}: ${(err as Error).message}`)
    }
  }

  return NextResponse.json({ checked: approved.length, cancelled, errors })
}
