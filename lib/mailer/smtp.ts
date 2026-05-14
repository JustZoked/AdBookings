import nodemailer from 'nodemailer'
import { env } from '../env'
import type { Mailer, SendMailOptions } from './index'

export class SmtpMailer implements Mailer {
  private transporter: nodemailer.Transporter

  constructor() {
    if (!env.SMTP_HOST || !env.SMTP_PORT) {
      throw new Error('SMTP mailer requires SMTP_HOST and SMTP_PORT')
    }
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
    })
  }

  async send(opts: SendMailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: env.SMTP_FROM ?? `"Adsemble Bookings" <${env.SMTP_USER}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      cc: opts.cc?.join(', '),
      replyTo: opts.replyTo,
    })
  }
}
