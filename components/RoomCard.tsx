import Link from 'next/link'
import { RoomCarousel } from './RoomCarousel'

interface RoomCardProps {
  room: {
    id: string
    name: string
    slug: string
    description: string
    basePricePerHour: string | number
    capacity: number | null
    amenities: { id: string; label: string; price: string | number }[]
    images: { url: string; sortOrder: number }[]
  }
}

export function RoomCard({ room }: RoomCardProps) {
  const price = Number(room.basePricePerHour)

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm hover:shadow-md transition-shadow">
      <RoomCarousel images={room.images} roomName={room.name} />

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h2 className="text-xl font-bold text-gray-900">{room.name}</h2>
          {room.capacity != null && (
            <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              👥 {room.capacity}
            </span>
          )}
        </div>

        <p className="mb-4 line-clamp-3 text-sm text-gray-600">{room.description}</p>

        {room.amenities.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">
            {room.amenities.map((a) => (
              <span
                key={a.id}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
              >
                {a.label}
                {Number(a.price) > 0 && (
                  <span className="ml-1 text-gray-500">+${Number(a.price)}</span>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between">
          <span className="text-lg font-semibold text-primary">
            ${price.toFixed(2)}
            <span className="text-sm font-normal text-gray-500">/hr</span>
          </span>
          <Link
            href={`/booking?room=${room.slug}`}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            Reserve Room
          </Link>
        </div>
      </div>
    </div>
  )
}
