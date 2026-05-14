import type { PrismaClient } from '@prisma/client'

export interface TimeRange {
  start: Date
  end: Date
}

/**
 * Returns true if the proposed [startAt, endAt] slot is available for the given room.
 * Checks PENDING and APPROVED reservations with a buffer on each side.
 */
export async function isSlotAvailable(
  prisma: PrismaClient,
  roomId: string,
  startAt: Date,
  endAt: Date,
  bufferMinutes = 15,
  excludeReservationId?: string
): Promise<boolean> {
  const bufferMs = bufferMinutes * 60 * 1000

  // The slot occupies [startAt - buffer, endAt + buffer]
  const slotStart = new Date(startAt.getTime() - bufferMs)
  const slotEnd = new Date(endAt.getTime() + bufferMs)

  const conflicting = await prisma.reservation.findFirst({
    where: {
      roomId,
      status: { in: ['PENDING', 'APPROVED'] },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      // Overlap condition: existing.startAt < slotEnd AND existing.endAt > slotStart
      startAt: { lt: slotEnd },
      endAt: { gt: slotStart },
    },
  })

  return conflicting === null
}

/**
 * Returns all blocked time ranges for a room on a given day (UTC date boundaries).
 * Each blocked range includes the buffer on both sides.
 */
export async function getBlockedRanges(
  prisma: PrismaClient,
  roomId: string,
  fromDate: Date,
  toDate: Date,
  bufferMinutes = 15
): Promise<TimeRange[]> {
  const bufferMs = bufferMinutes * 60 * 1000

  const reservations = await prisma.reservation.findMany({
    where: {
      roomId,
      status: { in: ['PENDING', 'APPROVED'] },
      startAt: { lt: toDate },
      endAt: { gt: fromDate },
    },
    select: { startAt: true, endAt: true },
    orderBy: { startAt: 'asc' },
  })

  return reservations.map((r) => ({
    start: new Date(r.startAt.getTime() - bufferMs),
    end: new Date(r.endAt.getTime() + bufferMs),
  }))
}
