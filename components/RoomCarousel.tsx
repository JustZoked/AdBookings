'use client'

import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import Image from 'next/image'
import { useRef } from 'react'

interface RoomCarouselProps {
  images: { url: string; sortOrder: number }[]
  roomName: string
}

export function RoomCarousel({ images, roomName }: RoomCarouselProps) {
  const autoplayRef = useRef(Autoplay({ delay: 3000, stopOnInteraction: false }))
  const [emblaRef] = useEmblaCarousel({ loop: true }, [autoplayRef.current])

  if (images.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center bg-gray-100 rounded-t-lg">
        <span className="text-4xl">🏢</span>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-t-lg" ref={emblaRef}>
      <div className="flex">
        {images.map((img, idx) => (
          <div key={idx} className="relative min-w-full h-48 flex-shrink-0">
            <Image
              src={img.url}
              alt={`${roomName} - imagen ${idx + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority={idx === 0}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
