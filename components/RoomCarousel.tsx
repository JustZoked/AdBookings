'use client'

import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import Image from 'next/image'
import { useRef, useCallback } from 'react'

interface RoomCarouselProps {
  images: { url: string; sortOrder: number }[]
  roomName: string
}

export function RoomCarousel({ images, roomName }: RoomCarouselProps) {
  const autoplayRef = useRef(Autoplay({ delay: 3000, stopOnInteraction: true }))
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [autoplayRef.current])

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  if (images.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center bg-gray-100 rounded-t-lg">
        <span className="text-4xl">🏢</span>
      </div>
    )
  }

  return (
    <div className="relative rounded-t-lg overflow-hidden group">
      <div className="overflow-hidden" ref={emblaRef}>
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

      {images.length > 1 && (
        <>
          <button
            onClick={scrollPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
            aria-label="Anterior"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={scrollNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
            aria-label="Siguiente"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}
