import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { env } from '../env'

const TZ = 'America/Santo_Domingo'

function formatLocal(date: Date, fmt: string): string {
  return format(toZonedTime(date, TZ), fmt)
}

function base(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Adsemble Bookings</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">
      <tr>
        <td style="background:#1e3a5f;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:bold;">🏢 Adsemble Bookings</span>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          ${content}
        </td>
      </tr>
      <tr>
        <td style="background:#f4f4f5;padding:16px 32px;text-align:center;">
          <span style="color:#6b7280;font-size:12px;">Adsemble Bookings — Sistema de reserva de salones</span>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

interface ReservationSummary {
  id: string
  roomName: string
  requesterName: string
  requesterEmail: string
  activity: string
  startAt: Date
  endAt: Date
  grandTotal: number
  adminNotes?: string | null
}

function summaryTable(r: ReservationSummary): string {
  const dateStr = formatLocal(r.startAt, 'EEEE, d MMMM yyyy')
  const startStr = formatLocal(r.startAt, 'HH:mm')
  const endStr = formatLocal(r.endAt, 'HH:mm')
  return `
<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;width:40%;border:1px solid #e5e7eb;">Salón</td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${r.roomName}</td></tr>
  <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;border:1px solid #e5e7eb;">Fecha</td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${dateStr}</td></tr>
  <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;border:1px solid #e5e7eb;">Horario</td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${startStr} – ${endStr}</td></tr>
  <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;border:1px solid #e5e7eb;">Solicitante</td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${r.requesterName} &lt;${r.requesterEmail}&gt;</td></tr>
  <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;border:1px solid #e5e7eb;">Actividad</td>
      <td style="padding:8px;border:1px solid #e5e7eb;">${r.activity}</td></tr>
  <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;border:1px solid #e5e7eb;">Total estimado</td>
      <td style="padding:8px;border:1px solid #e5e7eb;">$${r.grandTotal.toFixed(2)}</td></tr>
</table>`
}

export function pendingConfirmationEmail(r: ReservationSummary): { subject: string; html: string } {
  return {
    subject: `Solicitud de reserva recibida — ${r.roomName}`,
    html: base(`
<h2 style="color:#1e3a5f;margin-top:0;">Solicitud de reserva recibida</h2>
<p>Hola <strong>${r.requesterName}</strong>,</p>
<p>Hemos recibido tu solicitud de reserva. La revisaremos y te notificaremos cuando sea aprobada.</p>
${summaryTable(r)}
<p style="color:#6b7280;font-size:14px;">Si tienes alguna pregunta, contáctanos en <a href="mailto:${env.CONTACT_EMAIL}">${env.CONTACT_EMAIL}</a>.</p>
`),
  }
}

export function newReservationAdminEmail(
  r: ReservationSummary,
  approveUrl: string,
  rejectUrl: string
): { subject: string; html: string } {
  return {
    subject: `Nueva solicitud de reserva — ${r.roomName} (${formatLocal(r.startAt, 'd MMM yyyy')})`,
    html: base(`
<h2 style="color:#1e3a5f;margin-top:0;">Nueva solicitud de reserva</h2>
<p>Se ha recibido una nueva solicitud que requiere tu aprobación.</p>
${summaryTable(r)}
<p style="text-align:center;margin:32px 0;">
  <a href="${approveUrl}"
     style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:6px;font-size:16px;font-weight:bold;margin-right:16px;">
    ✅ APROBAR RESERVA
  </a>
  <a href="${rejectUrl}"
     style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:6px;font-size:16px;font-weight:bold;">
    ❌ RECHAZAR RESERVA
  </a>
</p>
<p style="color:#6b7280;font-size:12px;text-align:center;">Los links son válidos por ${env.ACTION_TOKEN_TTL_DAYS} días. ID de reserva: ${r.id}</p>
`),
  }
}

export function rejectedEmail(r: ReservationSummary): { subject: string; html: string } {
  return {
    subject: `Reserva rechazada — ${r.roomName}`,
    html: base(`
<h2 style="color:#dc2626;margin-top:0;">Reserva rechazada</h2>
<p>Hola <strong>${r.requesterName}</strong>,</p>
<p>Lamentamos informarte que tu solicitud de reserva ha sido rechazada.</p>
${summaryTable(r)}
${
  r.adminNotes
    ? `<div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:16px 0;">
         <strong>Motivo:</strong> ${r.adminNotes}
       </div>`
    : ''
}
<p>Si tienes alguna pregunta, contáctanos en <a href="mailto:${env.CONTACT_EMAIL}">${env.CONTACT_EMAIL}</a>.</p>
`),
  }
}

export function graphErrorAdminEmail(
  r: ReservationSummary,
  operation: string,
  error: string,
  retryUrl: string
): { subject: string; html: string } {
  return {
    subject: `Error de sincronización de calendario — ${r.roomName}`,
    html: base(`
<h2 style="color:#d97706;margin-top:0;">Error de sincronización con el calendario</h2>
<p>La operación <strong>${operation}</strong> para la siguiente reserva falló:</p>
${summaryTable(r)}
<p><strong>Error:</strong></p>
<pre style="background:#f4f4f5;padding:12px;border-radius:4px;font-size:12px;overflow:auto;">${error}</pre>
<p style="text-align:center;margin:32px 0;">
  <a href="${retryUrl}"
     style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:6px;font-size:16px;font-weight:bold;">
    🔄 REINTENTAR SINCRONIZACIÓN
  </a>
</p>
<p style="color:#6b7280;font-size:12px;text-align:center;">ID de reserva: ${r.id}</p>
`),
  }
}
