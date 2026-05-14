import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { PriceBreakdown } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

const TZ = process.env.TZ ?? 'America/Santo_Domingo'

function formatLocal(date: Date, fmt: string) {
  return format(toZonedTime(date, TZ), fmt)
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  PENDING: { label: 'Pendiente de aprobación', color: 'text-amber-600 bg-amber-50', icon: '⏳' },
  APPROVED: { label: 'Aprobada', color: 'text-green-600 bg-green-50', icon: '✅' },
  REJECTED: { label: 'Rechazada', color: 'text-red-600 bg-red-50', icon: '❌' },
}

interface Props {
  searchParams: { id?: string }
}

export default async function ConfirmationPage({ searchParams }: Props) {
  const { id } = searchParams

  if (!id) notFound()

  const reservation = await db.reservation.findUnique({
    where: { id },
    include: { room: true },
  })

  if (!reservation) notFound()

  const breakdown = reservation.priceBreakdown as PriceBreakdown | null
  const status = STATUS_LABELS[reservation.status] ?? STATUS_LABELS.PENDING

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-8 py-6 text-white">
          <p className="text-sm font-medium text-blue-200 mb-1">Solicitud recibida</p>
          <h1 className="text-2xl font-bold">Reserva #{id.slice(-8).toUpperCase()}</h1>
          <span
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${status.color}`}
          >
            {status.icon} {status.label}
          </span>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Alert */}
          {reservation.status === 'PENDING' && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
              📧 Recibirás un email de confirmación cuando tu reserva sea aprobada.
            </div>
          )}

          {/* Summary */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Detalle de la reserva</h2>
            <dl className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {[
                { label: 'Salón', value: reservation.room.name },
                {
                  label: 'Fecha',
                  value: formatLocal(reservation.startAt, "EEEE, d 'de' MMMM yyyy"),
                },
                {
                  label: 'Horario',
                  value: `${formatLocal(reservation.startAt, 'HH:mm')} – ${formatLocal(reservation.endAt, 'HH:mm')}`,
                },
                { label: 'Solicitante', value: reservation.requesterName },
                { label: 'Email', value: reservation.requesterEmail },
                { label: 'Actividad', value: reservation.activity },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-4 px-4 py-3">
                  <dt className="w-32 shrink-0 text-sm font-medium text-gray-500">{label}</dt>
                  <dd className="text-sm text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Price breakdown */}
          {breakdown && (
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-3">Precio estimado</h2>
              <div className="rounded-lg border border-gray-100 px-4 py-3 space-y-1">
                {breakdown.lines.slice(0, -1).map((line, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">{line.split(' = ')[0]}</span>
                    <span className="font-medium">{line.split(' = ')[1] ?? ''}</span>
                  </div>
                ))}
                <div className="border-t mt-2 pt-2 flex justify-between font-bold text-base">
                  <span>Total estimado</span>
                  <span className="text-primary">
                    ${Number(reservation.calculatedPrice).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {reservation.adminNotes && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-800">
              <strong>Motivo:</strong> {reservation.adminNotes}
            </div>
          )}

          <Link
            href="/"
            className="block w-full rounded-md bg-primary py-3 text-center text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
