import { env } from '../env'

export interface CreateBookingEventOpts {
  roomEmail: string
  roomName: string
  requesterEmail: string
  requesterName: string
  activity: string
  startAt: Date
  endAt: Date
  timezone: string
  bodyHtml: string
}

export interface CancelBookingEventOpts {
  organizerEmail: string
  eventId: string
  cancellationReason?: string
}

export interface CalendarService {
  createBookingEvent(opts: CreateBookingEventOpts): Promise<{ eventId: string }>
  cancelBookingEvent(opts: CancelBookingEventOpts): Promise<void>
}

let _calendarService: CalendarService | null = null

export async function getCalendarService(): Promise<CalendarService> {
  if (_calendarService) return _calendarService

  if (env.CALENDAR_ENABLED) {
    const { GraphCalendarService } = await import('./graph')
    _calendarService = new GraphCalendarService()
  } else {
    const { NoopCalendarService } = await import('./noop')
    _calendarService = new NoopCalendarService()
  }

  return _calendarService
}
