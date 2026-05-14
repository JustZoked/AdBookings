import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getBlockedRanges } from '@/lib/availability'
import { env } from '@/lib/env'
import { startOfDay, endOfDay } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

const schema = z.object({
  roomId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
})

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const parsed = schema.safeParse({
    roomId: searchParams.get('roomId'),
    date: searchParams.get('date'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { roomId, date } = parsed.data
  const tz = env.TZ

  // Get start/end of the requested day in local time, converted to UTC
  const localDay = toZonedTime(new Date(`${date}T12:00:00Z`), tz)
  const fromUTC = fromZonedTime(startOfDay(localDay), tz)
  const toUTC = fromZonedTime(endOfDay(localDay), tz)

  const blocked = await getBlockedRanges(db, roomId, fromUTC, toUTC, env.BOOKING_BUFFER_MINUTES)

  return NextResponse.json({
    blocked: blocked.map((r) => ({ start: r.start.toISOString(), end: r.end.toISOString() })),
  })
}
