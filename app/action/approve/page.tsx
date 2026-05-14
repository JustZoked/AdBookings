import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { verifyActionToken } from '@/lib/tokens'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { ApproveButton } from './ApproveButton'

const TZ = process.env.TZ ?? 'America/Santo_Domingo'

interface Props {
  searchParams: { token?: string }
}

export default async function ApprovePage({ searchParams }: Props) {
  const { token } = searchParams

  if (!token) {
    return <InvalidToken />
  }

  const payload = verifyActionToken(token)
  if (!payload || payload.action !== 'approve') {
    return <InvalidToken />
  }

  const reservation = await db.reservation.findUnique({
    where: { id: payload.reservationId },
    include: { room: true },
  })

  if (!reservation) {
    return <InvalidToken />
  }

  if (reservation.status !== 'PENDING') {
    return (
      <ActionLayout title="Reserva ya procesada" icon="ℹ️">
        <p className="text-gray-700 mb-4">
          Esta reserva ya fue <strong>{reservation.status === 'APPROVED' ? 'aprobada' : 'rechazada'}</strong> previamente.
          No es necesario realizar ninguna acción adicional.
        </p>
        <Link href="/" className="btn-primary">Volver al inicio</Link>
      </ActionLayout>
    )
  }

  const localStart = format(toZonedTime(reservation.startAt, TZ), "EEEE d MMM yyyy, HH:mm")
  const localEnd = format(toZonedTime(reservation.endAt, TZ), 'HH:mm')

  return (
    <ActionLayout title="Aprobar reserva" icon="✅">
      <div className="mb-6 rounded-lg border border-gray-100 divide-y divide-gray-100">
        {[
          ['Salón', reservation.room.name],
          ['Horario', `${localStart} – ${localEnd}`],
          ['Solicitante', `${reservation.requesterName} (${reservation.requesterEmail})`],
          ['Actividad', reservation.activity],
          ['Total estimado', `$${Number(reservation.calculatedPrice).toFixed(2)}`],
        ].map(([label, value]) => (
          <div key={label} className="flex gap-4 px-4 py-3">
            <span className="w-32 shrink-0 text-sm font-medium text-gray-500">{label}</span>
            <span className="text-sm text-gray-900">{value}</span>
          </div>
        ))}
      </div>
      <p className="mb-6 text-sm text-gray-600">
        Al aprobar, se creará un evento en el calendario del salón y el solicitante recibirá el invite.
      </p>
      <ApproveButton reservationId={reservation.id} token={token} />
    </ActionLayout>
  )
}

function ActionLayout({
  title,
  icon,
  children,
}: {
  title: string
  icon: string
  children: React.ReactNode
}) {
  return (
    <div className="container mx-auto max-w-xl px-4 py-12">
      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="bg-primary px-8 py-6 text-white">
          <span className="text-4xl">{icon}</span>
          <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        </div>
        <div className="px-8 py-6">{children}</div>
      </div>
    </div>
  )
}

function InvalidToken() {
  return (
    <ActionLayout title="Link inválido" icon="⚠️">
      <p className="text-gray-700 mb-4">
        Este link ya no es válido o ha expirado. Por favor, accede al correo más reciente o
        contacta a IT.
      </p>
      <Link href="/" className="block w-full rounded-md bg-primary py-3 text-center text-sm font-semibold text-white hover:bg-primary/90">
        Volver al inicio
      </Link>
    </ActionLayout>
  )
}
