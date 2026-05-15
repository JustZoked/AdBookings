import { ClientSecretCredential } from '@azure/identity'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { env } from '../env'
import type { CalendarService, CreateBookingEventOpts, CancelBookingEventOpts } from './index'

export class GraphCalendarService implements CalendarService {
  private credential: ClientSecretCredential
  private cachedToken: { value: string; expiresAt: number } | null = null

  constructor() {
    if (!env.MS_TENANT_ID || !env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET || !env.MS_SENDER_EMAIL) {
      throw new Error(
        'Graph calendar requires MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER_EMAIL'
      )
    }
    this.credential = new ClientSecretCredential(
      env.MS_TENANT_ID,
      env.MS_CLIENT_ID,
      env.MS_CLIENT_SECRET
    )
  }

  private async getToken(): Promise<string> {
    const now = Date.now()
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return this.cachedToken.value
    }
    const token = await this.credential.getToken('https://graph.microsoft.com/.default')
    if (!token) throw new Error('Failed to acquire Graph token')
    this.cachedToken = { value: token.token, expiresAt: token.expiresOnTimestamp }
    return token.token
  }

  async createBookingEvent(opts: CreateBookingEventOpts): Promise<{ eventId: string }> {
    const token = await this.getToken()
    const organizerEmail = env.MS_SENDER_EMAIL!

    // Format datetime in local time (Graph accepts the timezone field)
    const fmt = "yyyy-MM-dd'T'HH:mm:ss"
    const localStart = format(toZonedTime(opts.startAt, opts.timezone), fmt)
    const localEnd = format(toZonedTime(opts.endAt, opts.timezone), fmt)

    const body = {
      subject: `[${opts.roomName}] ${opts.activity}`,
      body: { contentType: 'HTML', content: opts.bodyHtml },
      start: { dateTime: localStart, timeZone: opts.timezone },
      end: { dateTime: localEnd, timeZone: opts.timezone },
      attendees: [
        {
          emailAddress: { address: opts.roomEmail, name: opts.roomName },
          type: 'resource',
        },
        {
          emailAddress: { address: opts.requesterEmail, name: opts.requesterName },
          type: 'required',
        },
      ],
      location: {
        displayName: opts.roomName,
        locationType: 'conferenceRoom',
      },
      isOnlineMeeting: false,
      allowNewTimeProposals: false,
      responseRequested: false,
    }

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(organizerEmail)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Graph createEvent failed (${res.status}): ${text}`)
    }

    const data = await res.json()
    return { eventId: data.id }
  }

  async cancelBookingEvent(opts: CancelBookingEventOpts): Promise<void> {
    const token = await this.getToken()
    const organizerEmail = opts.organizerEmail

    // First try the cancel endpoint (sends cancellation notification to attendees)
    const cancelRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(organizerEmail)}/events/${opts.eventId}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment: opts.cancellationReason ?? 'Reserva cancelada' }),
      }
    )

    if (cancelRes.ok) return

    // If 404, event was deleted manually — try DELETE as fallback
    if (cancelRes.status === 404) {
      const deleteRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(organizerEmail)}/events/${opts.eventId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      // 404 on DELETE also means already gone — treat as success
      if (deleteRes.ok || deleteRes.status === 404) return
      const text = await deleteRes.text()
      throw new Error(`Graph deleteEvent fallback failed (${deleteRes.status}): ${text}`)
    }

    const text = await cancelRes.text()
    throw new Error(`Graph cancelEvent failed (${cancelRes.status}): ${text}`)
  }
}
