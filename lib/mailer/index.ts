import { env } from '../env'

export interface SendMailOptions {
  to: string
  subject: string
  html: string
  cc?: string[]
  replyTo?: string
}

export interface Mailer {
  send(opts: SendMailOptions): Promise<void>
}

let _mailer: Mailer | null = null

export async function getMailer(): Promise<Mailer> {
  if (_mailer) return _mailer

  if (env.MAIL_DRIVER === 'graph') {
    const { GraphMailer } = await import('./graph')
    _mailer = new GraphMailer()
  } else {
    const { SmtpMailer } = await import('./smtp')
    _mailer = new SmtpMailer()
  }

  return _mailer
}
