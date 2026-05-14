import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { BookingForm } from '@/components/BookingForm'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: { room?: string }
}

export default async function BookingPage({ searchParams }: Props) {
  const slug = searchParams.room

  if (!slug) {
    redirect('/')
  }

  const room = await db.room.findUnique({
    where: { slug, isActive: true },
    include: {
      amenities: { orderBy: { sortOrder: 'asc' } },
    },
  })

  if (!room) {
    redirect('/?error=room-not-found')
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Volver a salones
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          Reservar — <span className="text-primary">{room.name}</span>
        </h1>
        <p className="mt-1 text-gray-600">
          Completa el formulario y recibirás confirmación por correo.
        </p>
      </div>

      <BookingForm
        room={{
          id: room.id,
          name: room.name,
          slug: room.slug,
          basePricePerHour: room.basePricePerHour.toString(),
          minAdvanceHours: room.minAdvanceHours,
          amenities: room.amenities.map((a) => ({
            id: a.id,
            label: a.label,
            price: a.price.toString(),
          })),
        }}
      />
    </div>
  )
}
