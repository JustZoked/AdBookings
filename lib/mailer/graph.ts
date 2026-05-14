import { ClientSecretCredential } from '@azure/identity'
import { env } from '../env'
import type { Mailer, SendMailOptions } from './index'

export class GraphMailer implements Mailer {
  private credential: ClientSecretCredential
  private cachedToken: { value: string; expiresAt: number } | null = null

  constructor() {
    if (!env.MS_TENANT_ID || !env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET || !env.MS_SENDER_EMAIL) {
      throw new Error(
        'Graph mailer requires MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER_EMAIL'
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
    this.cachedToken = {
      value: token.token,
      expiresAt: token.expiresOnTimestamp,
    }
    return token.token
  }

  async send(opts: SendMailOptions): Promise<void> {
    const token = await this.getToken()
    const senderEmail = env.MS_SENDER_EMAIL!

    const body = {
      message: {
        subject: opts.subject,
        body: { contentType: 'HTML', content: opts.html },
        toRecipients: [{ emailAddress: { address: opts.to } }],
        ...(opts.cc?.length
          ? { ccRecipients: opts.cc.map((a) => ({ emailAddress: { address: a } })) }
          : {}),
        ...(opts.replyTo
          ? { replyTo: [{ emailAddress: { address: opts.replyTo } }] }
          : {}),
      },
      saveToSentItems: true,
    }

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`,
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
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          `Graph sendMail auth error (${res.status}): verify Mail.Send permission + admin consent + ApplicationAccessPolicy. Detail: ${text}`
        )
      }
      throw new Error(`Graph sendMail failed (${res.status}): ${text}`)
    }
  }
}
