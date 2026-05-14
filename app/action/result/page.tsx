import Link from 'next/link'

interface Props {
  searchParams: { type?: string; id?: string }
}

const RESULTS = {
  approved: {
    icon: '✅',
    title: 'Reserva aprobada',
    message:
      'La reserva ha sido aprobada. Se ha enviado el invite del calendario al solicitante y al salón. Las pantallas reflejarán el cambio automáticamente.',
    color: 'text-green-700 bg-green-50 border-green-100',
  },
  rejected: {
    icon: '❌',
    title: 'Reserva rechazada',
    message:
      'La reserva ha sido rechazada. El solicitante ha sido notificado por correo electrónico.',
    color: 'text-red-700 bg-red-50 border-red-100',
  },
  error: {
    icon: '⚠️',
    title: 'Error al procesar',
    message:
      'Ocurrió un error al procesar la acción. Por favor, contacta a IT o intenta de nuevo desde el correo.',
    color: 'text-amber-700 bg-amber-50 border-amber-100',
  },
}

export default function ResultPage({ searchParams }: Props) {
  const type = (searchParams.type ?? 'error') as keyof typeof RESULTS
  const result = RESULTS[type] ?? RESULTS.error

  return (
    <div className="container mx-auto max-w-xl px-4 py-12">
      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="bg-primary px-8 py-6 text-white">
          <span className="text-4xl">{result.icon}</span>
          <h1 className="mt-2 text-2xl font-bold">{result.title}</h1>
        </div>
        <div className="px-8 py-6">
          <div className={`rounded-lg border p-4 mb-6 text-sm ${result.color}`}>
            {result.message}
          </div>
          {searchParams.id && (
            <p className="mb-4 text-xs text-gray-500">
              ID de reserva: <span className="font-mono">{searchParams.id}</span>
            </p>
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
