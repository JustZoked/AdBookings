import { getDay, getHours, getMinutes } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

export interface AmenityPricing {
  id: string
  label: string
  price: number
}

export interface PriceBreakdown {
  baseHours: number
  nightHours: number
  weekendApplied: boolean
  subtotalBase: number
  nightSurcharge: number
  weekendSurcharge: number
  amenitiesTotal: number
  grandTotal: number
  lines: string[]
}

export interface PricingConfig {
  basePricePerHour: number
  nightSurchargeStartHour?: number  // default 18
  nightSurchargePercent?: number    // default 30
  weekendSurchargePercent?: number  // default 30
  timezone?: string                 // default 'America/Santo_Domingo'
}

/**
 * Calculates the price for a booking, applying night and weekend surcharges.
 *
 * Surcharges are ADDITIVE (not multiplicative):
 *   night+weekend slot = base × (1 + 0.30 + 0.30) = base × 1.60
 *
 * Night surcharge applies only to the fractional portion of hours after nightSurchargeStartHour.
 * Weekend surcharge applies to the entire reservation if startAt falls on Sat/Sun (local time).
 */
export function calculatePrice(
  startAt: Date,
  endAt: Date,
  config: PricingConfig,
  amenities: AmenityPricing[] = []
): PriceBreakdown {
  const {
    basePricePerHour,
    nightSurchargeStartHour = 18,
    nightSurchargePercent = 30,
    weekendSurchargePercent = 30,
    timezone = 'America/Santo_Domingo',
  } = config

  const nightRate = nightSurchargePercent / 100
  const weekendRate = weekendSurchargePercent / 100

  // Convert to local time for rule evaluation
  const localStart = toZonedTime(startAt, timezone)
  const localEnd = toZonedTime(endAt, timezone)

  const totalMinutes = (endAt.getTime() - startAt.getTime()) / (1000 * 60)
  const totalHours = totalMinutes / 60

  // Weekend check: if startAt is Saturday (6) or Sunday (0) in local time
  const dayOfWeek = getDay(localStart)
  const weekendApplied = dayOfWeek === 0 || dayOfWeek === 6

  // Calculate day vs night hours split
  // Night portion = hours that fall on or after nightSurchargeStartHour in local time
  const startHour = getHours(localStart) + getMinutes(localStart) / 60
  const endHour = getHours(localEnd) + getMinutes(localEnd) / 60

  let nightHours = 0
  if (endHour > nightSurchargeStartHour && startHour < nightSurchargeStartHour) {
    // Crosses the threshold: partial night
    nightHours = endHour - nightSurchargeStartHour
  } else if (startHour >= nightSurchargeStartHour) {
    // Entirely at night
    nightHours = totalHours
  }
  // If endHour <= nightSurchargeStartHour, no night hours

  const dayHours = totalHours - nightHours

  // Subtotal base (no surcharges yet)
  const subtotalBase = basePricePerHour * totalHours

  // Night surcharge only on night hours
  const nightSurcharge = basePricePerHour * nightHours * nightRate

  // Weekend surcharge on entire booking
  const weekendSurcharge = weekendApplied ? basePricePerHour * totalHours * weekendRate : 0

  // Amenities: flat per amenity, not scaled by hours
  const amenitiesTotal = amenities.reduce((sum, a) => sum + a.price, 0)

  const grandTotal = subtotalBase + nightSurcharge + weekendSurcharge + amenitiesTotal

  // Build human-readable lines
  const lines: string[] = []

  if (dayHours > 0 && nightHours > 0) {
    lines.push(
      `${round2(dayHours)}h daytime × $${basePricePerHour}/hr = $${round2(basePricePerHour * dayHours)}`
    )
    lines.push(
      `${round2(nightHours)}h night × $${basePricePerHour}/hr = $${round2(basePricePerHour * nightHours)}`
    )
    lines.push(
      `Night surcharge (+${nightSurchargePercent}%) on ${round2(nightHours)}h = +$${round2(nightSurcharge)}`
    )
  } else if (nightHours > 0) {
    lines.push(
      `${round2(totalHours)}h night × $${basePricePerHour}/hr = $${round2(subtotalBase)}`
    )
    lines.push(
      `Night surcharge (+${nightSurchargePercent}%) = +$${round2(nightSurcharge)}`
    )
  } else {
    lines.push(`${round2(totalHours)}h × $${basePricePerHour}/hr = $${round2(subtotalBase)}`)
  }

  if (weekendApplied) {
    lines.push(
      `Weekend surcharge (+${weekendSurchargePercent}%) = +$${round2(weekendSurcharge)}`
    )
  }

  for (const a of amenities) {
    if (a.price > 0) {
      lines.push(`${a.label} = +$${round2(a.price)}`)
    }
  }

  lines.push(`Total: $${round2(grandTotal)}`)

  return {
    baseHours: totalHours,
    nightHours,
    weekendApplied,
    subtotalBase: round2(subtotalBase),
    nightSurcharge: round2(nightSurcharge),
    weekendSurcharge: round2(weekendSurcharge),
    amenitiesTotal: round2(amenitiesTotal),
    grandTotal: round2(grandTotal),
    lines,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
