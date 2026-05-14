import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { calculatePrice } from '@/lib/pricing'
import { env } from '@/lib/env'

const schema = z.object({
  roomId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
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

  const { roomId, startAt: startStr, endAt: endStr, amenityIds } = parsed.data
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

  return NextResponse.json(breakdown)
}
