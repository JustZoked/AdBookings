import { describe, it, expect } from 'vitest'
import { calculatePrice } from '@/lib/pricing'

const TZ = 'America/Santo_Domingo'
const BASE = 100

// Helper: create Date from local time string "YYYY-MM-DDTHH:mm"
function localDate(iso: string): Date {
  // Santo Domingo is UTC-4 (no DST)
  const utcOffsetMs = 4 * 60 * 60 * 1000
  return new Date(new Date(iso + ':00Z').getTime() + utcOffsetMs)
}

const cfg = { basePricePerHour: BASE, timezone: TZ }

describe('calculatePrice', () => {
  it('weekday daytime (17:00–18:00): no surcharges', () => {
    // Monday 2026-05-18, 17:00–18:00 local = 21:00–22:00 UTC
    const start = new Date('2026-05-18T21:00:00Z')
    const end   = new Date('2026-05-18T22:00:00Z')
    const result = calculatePrice(start, end, cfg)
    expect(result.grandTotal).toBe(100)
    expect(result.nightHours).toBe(0)
    expect(result.weekendApplied).toBe(false)
  })

  it('weekday mixed day+night (17:00–19:00): $100 + $130 = $230', () => {
    // The critical example from the spec
    const start = new Date('2026-05-18T21:00:00Z') // 17:00 local
    const end   = new Date('2026-05-18T23:00:00Z') // 19:00 local
    const result = calculatePrice(start, end, cfg)
    expect(result.nightHours).toBe(1)
    expect(result.grandTotal).toBe(230)
    expect(result.weekendApplied).toBe(false)
  })

  it('weekday all-night (19:00–21:00): base×1.30 per hour', () => {
    const start = new Date('2026-05-18T23:00:00Z') // 19:00 local
    const end   = new Date('2026-05-19T01:00:00Z') // 21:00 local
    const result = calculatePrice(start, end, cfg)
    expect(result.nightHours).toBe(2)
    expect(result.subtotalBase).toBe(200)
    expect(result.nightSurcharge).toBe(60) // 100 * 2 * 0.30
    expect(result.grandTotal).toBe(260)
  })

  it('Saturday daytime: weekend surcharge only (base×1.30)', () => {
    // Saturday 2026-05-16, 10:00–12:00 local
    const start = new Date('2026-05-16T14:00:00Z') // 10:00 local
    const end   = new Date('2026-05-16T16:00:00Z') // 12:00 local
    const result = calculatePrice(start, end, cfg)
    expect(result.weekendApplied).toBe(true)
    expect(result.nightHours).toBe(0)
    expect(result.grandTotal).toBe(260) // 200 base + 60 weekend
  })

  it('Sunday all-night (19:00–21:00): both surcharges, additive (base×1.60)', () => {
    // Sunday 2026-05-17, 19:00–21:00 local
    const start = new Date('2026-05-17T23:00:00Z') // 19:00 local
    const end   = new Date('2026-05-18T01:00:00Z') // 21:00 local
    const result = calculatePrice(start, end, cfg)
    expect(result.weekendApplied).toBe(true)
    expect(result.nightHours).toBe(2)
    // 2h × $100 = $200 base
    // night: 200 × 0.30 = 60
    // weekend: 200 × 0.30 = 60
    // total = 200 + 60 + 60 = 320
    expect(result.grandTotal).toBe(320)
  })

  it('fractional hours (1.5h, 17:00–18:30): 0.5h night surcharge', () => {
    const start = new Date('2026-05-18T21:00:00Z') // 17:00 local
    const end   = new Date('2026-05-18T22:30:00Z') // 18:30 local
    const result = calculatePrice(start, end, cfg)
    // 1h daytime, 0.5h night
    expect(result.nightHours).toBe(0.5)
    expect(result.subtotalBase).toBe(150)
    expect(result.nightSurcharge).toBe(15) // 100 * 0.5 * 0.30
    expect(result.grandTotal).toBe(165)
  })

  it('fractional hours (0.5h, 18:00–18:30): all night', () => {
    const start = new Date('2026-05-18T22:00:00Z') // 18:00 local
    const end   = new Date('2026-05-18T22:30:00Z') // 18:30 local
    const result = calculatePrice(start, end, cfg)
    expect(result.nightHours).toBe(0.5)
    expect(result.subtotalBase).toBe(50)
    expect(result.nightSurcharge).toBe(15)
    expect(result.grandTotal).toBe(65)
  })

  it('amenities are added flat, not scaled by hours', () => {
    const start = new Date('2026-05-18T14:00:00Z') // 10:00 local, weekday
    const end   = new Date('2026-05-18T16:00:00Z') // 12:00 local
    const amenities = [
      { id: '1', label: '📹 Video Conferencing', price: 30 },
      { id: '2', label: '☕ Coffee', price: 20 },
    ]
    const result = calculatePrice(start, end, cfg, amenities)
    expect(result.amenitiesTotal).toBe(50)
    expect(result.grandTotal).toBe(250) // 200 base + 50 amenities
  })

  it('multiple amenities on a weekend night', () => {
    // Saturday 19:00–21:00: base×1.60 + amenities
    const start = new Date('2026-05-16T23:00:00Z') // Sat 19:00 local
    const end   = new Date('2026-05-17T01:00:00Z') // Sat 21:00 local
    const amenities = [{ id: '1', label: '📹 Video', price: 30 }]
    const result = calculatePrice(start, end, cfg, amenities)
    // 2h × $100 = $200, night +$60, weekend +$60, amenity +$30
    expect(result.grandTotal).toBe(350)
  })
})
