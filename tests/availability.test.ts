import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isSlotAvailable, getBlockedRanges } from '@/lib/availability'

// Minimal prisma mock
function makePrisma(reservations: { startAt: Date; endAt: Date; id?: string }[]) {
  return {
    reservation: {
      findFirst: vi.fn(async ({ where }: { where: { startAt?: { lt: Date }; endAt?: { gt: Date } } }) => {
        const { startAt, endAt } = where
        const slotStart = endAt?.gt
        const slotEnd = startAt?.lt
        if (!slotStart || !slotEnd) return null
        const conflict = reservations.find(
          (r) => r.startAt < slotEnd && r.endAt > slotStart
        )
        return conflict ?? null
      }),
      findMany: vi.fn(async ({ where }: { where: { startAt?: { lt: Date }; endAt?: { gt: Date } } }) => {
        const { startAt, endAt } = where
        const from = endAt?.gt
        const to = startAt?.lt
        if (!from || !to) return []
        return reservations.filter(
          (r) => r.startAt < to && r.endAt > from
        )
      }),
    },
  }
}

describe('isSlotAvailable', () => {
  it('returns true when no existing reservations', async () => {
    const prisma = makePrisma([])
    const result = await isSlotAvailable(
      prisma as never,
      'room1',
      new Date('2026-05-18T14:00:00Z'),
      new Date('2026-05-18T16:00:00Z')
    )
    expect(result).toBe(true)
  })

  it('returns false when slot overlaps existing reservation', async () => {
    const prisma = makePrisma([
      {
        startAt: new Date('2026-05-18T14:00:00Z'),
        endAt: new Date('2026-05-18T16:00:00Z'),
      },
    ])
    // Trying to book 15:00–17:00 (overlaps)
    const result = await isSlotAvailable(
      prisma as never,
      'room1',
      new Date('2026-05-18T15:00:00Z'),
      new Date('2026-05-18T17:00:00Z')
    )
    expect(result).toBe(false)
  })

  it('buffer of 15 minutes: reservation 14:00–16:00 blocks until 16:30', async () => {
    // Approved reservation 14:00–16:00 → blocked real range 13:45–16:15
    const prisma = makePrisma([
      {
        startAt: new Date('2026-05-18T14:00:00Z'),
        endAt: new Date('2026-05-18T16:00:00Z'),
      },
    ])

    // Trying 16:00–17:00 should fail (within 15-min buffer of endAt 16:00 + 15min = 16:15)
    const tooClose = await isSlotAvailable(
      prisma as never,
      'room1',
      new Date('2026-05-18T16:00:00Z'),
      new Date('2026-05-18T17:00:00Z')
    )
    expect(tooClose).toBe(false)

    // Trying 16:30–17:30 should succeed (after buffer ends at 16:15)
    // Note: with 15-min buffer on new slot's start too, slotStart = 16:15, slotEnd = 17:45
    // blocked range ends at 16:15, new slotStart = 16:15 → no overlap
    const clearOfBuffer = await isSlotAvailable(
      prisma as never,
      'room1',
      new Date('2026-05-18T16:30:00Z'),
      new Date('2026-05-18T17:30:00Z')
    )
    expect(clearOfBuffer).toBe(true)
  })

  it('no overlap when slots are adjacent with enough gap', async () => {
    const prisma = makePrisma([
      {
        startAt: new Date('2026-05-18T10:00:00Z'),
        endAt: new Date('2026-05-18T12:00:00Z'),
      },
    ])
    // Book 12:30–14:00 (30 min gap > 15 min buffer on each side)
    const result = await isSlotAvailable(
      prisma as never,
      'room1',
      new Date('2026-05-18T12:30:00Z'),
      new Date('2026-05-18T14:00:00Z')
    )
    expect(result).toBe(true)
  })
})

describe('getBlockedRanges', () => {
  it('returns blocked ranges expanded by buffer', async () => {
    const start = new Date('2026-05-18T14:00:00Z')
    const end = new Date('2026-05-18T16:00:00Z')
    const prisma = makePrisma([{ startAt: start, endAt: end }])

    const ranges = await getBlockedRanges(
      prisma as never,
      'room1',
      new Date('2026-05-18T00:00:00Z'),
      new Date('2026-05-19T00:00:00Z')
    )

    expect(ranges).toHaveLength(1)
    expect(ranges[0].start).toEqual(new Date(start.getTime() - 15 * 60 * 1000))
    expect(ranges[0].end).toEqual(new Date(end.getTime() + 15 * 60 * 1000))
  })
})
