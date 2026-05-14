import { db } from '@/lib/db'
import { RoomCard } from '@/components/RoomCard'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const rooms = await db.room.findMany({
    where: { isActive: true },
    include: {
      amenities: { orderBy: { sortOrder: 'asc' } },
      images: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      {/* Hero */}
      <div className="mb-12 text-center">
        <div className="mb-4 text-6xl">🏢</div>
        <h1 className="mb-3 text-4xl font-bold text-gray-900">Adsemble Bookings</h1>
        <p className="mx-auto max-w-xl text-lg text-gray-600">
          Reserva nuestros salones de forma rápida y sencilla. Confirmaremos tu solicitud por correo electrónico.
        </p>
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No hay salones disponibles en este momento.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={{
                ...room,
                basePricePerHour: room.basePricePerHour.toString(),
                amenities: room.amenities.map((a) => ({
                  ...a,
                  price: a.price.toString(),
                })),
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
