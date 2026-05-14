import type { CalendarService, CreateBookingEventOpts, CancelBookingEventOpts } from './index'

export class NoopCalendarService implements CalendarService {
  async createBookingEvent(opts: CreateBookingEventOpts): Promise<{ eventId: string }> {
    console.log(`[calendar:noop] createBookingEvent skipped for room ${opts.roomEmail}`)
    return { eventId: 'noop' }
  }

  async cancelBookingEvent(opts: CancelBookingEventOpts): Promise<void> {
    console.log(`[calendar:noop] cancelBookingEvent skipped for event ${opts.eventId}`)
  }
}
