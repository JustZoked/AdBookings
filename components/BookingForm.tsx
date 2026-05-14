'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addHours, format, addDays } from 'date-fns'
import { PriceBreakdown } from './PriceBreakdown'
import type { PriceBreakdown as PriceBreakdownType } from '@/lib/pricing'

interface Amenity {
  id: string
  label: string
  price: string | number
}

interface Room {
  id: string
  name: string
  slug: string
  basePricePerHour: string | number
  minAdvanceHours: number
  amenities: Amenity[]
}

interface BookedSlot {
  start: string
  end: string
}

const schema = z.object({
  date: z.string().min(1, 'Selecciona una fecha'),
  startTime: z.string().min(1, 'Selecciona hora de inicio'),
  endTime: z.string().min(1, 'Selecciona hora de fin'),
  requesterName: z.string().min(2, 'Nombre mínimo 2 caracteres').max(100),
  requesterEmail: z.string().email('Email inválido'),
  activity: z.string().min(3, 'Describe la actividad').max(500),
  amenityIds: z.array(z.string()).optional(),
})

type FormValues = z.infer<typeof schema>

// Generate half-hour slots from 07:00 to 22:00
function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = 7; h <= 22; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`)
    if (h < 22) slots.push(`${h.toString().padStart(2, '0')}:30`)
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

function toUtcDatetime(date: string, time: string): string {
  // Input: "2026-05-18", "14:00" — Santo Domingo is UTC-4
  const localIso = `${date}T${time}:00`
  const localDate = new Date(localIso)
  // Santo Domingo = UTC-4 (no DST)
  const utcMs = localDate.getTime() + 4 * 60 * 60 * 1000
  return new Date(utcMs).toISOString()
}

function isSlotBlocked(date: string, time: string, blocked: BookedSlot[]): boolean {
  if (!date) return false
  const slotUtc = new Date(toUtcDatetime(date, time))
  return blocked.some((b) => {
    const start = new Date(b.start)
    const end = new Date(b.end)
    return slotUtc >= start && slotUtc < end
  })
}

export function BookingForm({ room }: { room: Room }) {
  const router = useRouter()
  const [breakdown, setBreakdown] = useState<PriceBreakdownType | null>(null)
  const [breakdownLoading, setBreakdownLoading] = useState(false)
  const [blockedSlots, setBlockedSlots] = useState<BookedSlot[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const minDate = format(addHours(new Date(), room.minAdvanceHours), 'yyyy-MM-dd')
  const defaultDate = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: defaultDate, amenityIds: [] },
  })

  const watchDate = watch('date')
  const watchStart = watch('startTime')
  const watchEnd = watch('endTime')
  const watchAmenitiesRaw = watch('amenityIds')
  const watchAmenities = watchAmenitiesRaw ?? []

  // Fetch blocked slots when date changes
  useEffect(() => {
    if (!watchDate) return
    fetch(`/api/availability?roomId=${room.id}&date=${watchDate}`)
      .then((r) => r.json())
      .then((d) => setBlockedSlots(d.blocked ?? []))
      .catch(() => setBlockedSlots([]))
  }, [watchDate, room.id])

  // Fetch price breakdown
  const fetchBreakdown = useCallback(async () => {
    if (!watchDate || !watchStart || !watchEnd) {
      setBreakdown(null)
      return
    }
    const startAt = toUtcDatetime(watchDate, watchStart)
    const endAt = toUtcDatetime(watchDate, watchEnd)
    if (new Date(endAt) <= new Date(startAt)) {
      setBreakdown(null)
      return
    }
    setBreakdownLoading(true)
    try {
      const res = await fetch('/api/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, startAt, endAt, amenityIds: watchAmenitiesRaw ?? [] }),
      })
      if (res.ok) {
        setBreakdown(await res.json())
      } else {
        setBreakdown(null)
      }
    } catch {
      setBreakdown(null)
    } finally {
      setBreakdownLoading(false)
    }
  }, [watchDate, watchStart, watchEnd, watchAmenitiesRaw, room.id])

  // Debounced price update
  useEffect(() => {
    const t = setTimeout(fetchBreakdown, 300)
    return () => clearTimeout(t)
  }, [fetchBreakdown])

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    setSubmitError(null)
    const startAt = toUtcDatetime(values.date, values.startTime)
    const endAt = toUtcDatetime(values.date, values.endTime)

    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: room.id,
        startAt,
        endAt,
        requesterName: values.requesterName,
        requesterEmail: values.requesterEmail,
        activity: values.activity,
        amenityIds: values.amenityIds ?? [],
      }),
    })

    if (res.ok) {
      const { id } = await res.json()
      router.push(`/confirmation?id=${id}`)
    } else {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }))
      setSubmitError(err.error ?? 'Error al enviar la solicitud')
      setSubmitting(false)
    }
  }

  const endTimeOptions = TIME_SLOTS.filter((t) => !watchStart || t > watchStart)

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-2 space-y-6">
        {/* Date & Time */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Fecha y horario</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fecha</label>
              <input
                type="date"
                min={minDate}
                {...register('date')}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Hora inicio</label>
              <select
                {...register('startTime')}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                onChange={(e) => {
                  setValue('startTime', e.target.value)
                  setValue('endTime', '')
                }}
              >
                <option value="">--</option>
                {TIME_SLOTS.map((t) => {
                  const blocked = isSlotBlocked(watchDate, t, blockedSlots)
                  return (
                    <option key={t} value={t} disabled={blocked}>
                      {t}
                      {blocked ? ' (ocupado)' : ''}
                    </option>
                  )
                })}
              </select>
              {errors.startTime && <p className="mt-1 text-xs text-red-600">{errors.startTime.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Hora fin</label>
              <select
                {...register('endTime')}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">--</option>
                {endTimeOptions.map((t) => {
                  const blocked = isSlotBlocked(watchDate, t, blockedSlots)
                  return (
                    <option key={t} value={t} disabled={blocked}>
                      {t}
                      {blocked ? ' (ocupado)' : ''}
                    </option>
                  )
                })}
              </select>
              {errors.endTime && <p className="mt-1 text-xs text-red-600">{errors.endTime.message}</p>}
            </div>
          </div>

          {/* Blocked slots visual indicator */}
          {blockedSlots.length > 0 && (
            <p className="mt-3 text-xs text-amber-600">
              ⚠ Algunos horarios están ocupados o en proceso de aprobación.
            </p>
          )}
        </div>

        {/* Amenities */}
        {room.amenities.length > 0 && (
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Amenidades adicionales</h2>
            <div className="space-y-3">
              {room.amenities.map((a) => (
                <label key={a.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    value={a.id}
                    {...register('amenityIds')}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">{a.label}</span>
                  {Number(a.price) > 0 && (
                    <span className="ml-auto text-sm font-medium text-gray-900">
                      +${Number(a.price).toFixed(2)}
                    </span>
                  )}
                  {Number(a.price) === 0 && (
                    <span className="ml-auto text-xs text-green-600">Incluido</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Contact info */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Datos del solicitante</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nombre completo
              </label>
              <input
                type="text"
                {...register('requesterName')}
                placeholder="Juan Pérez"
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.requesterName && (
                <p className="mt-1 text-xs text-red-600">{errors.requesterName.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Correo electrónico
              </label>
              <input
                type="email"
                {...register('requesterEmail')}
                placeholder="juan@empresa.com"
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.requesterEmail && (
                <p className="mt-1 text-xs text-red-600">{errors.requesterEmail.message}</p>
              )}
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Actividad / motivo de la reserva
            </label>
            <textarea
              {...register('activity')}
              rows={3}
              placeholder="Ej: Reunión de equipo de marketing, capacitación de nuevos empleados..."
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            {errors.activity && (
              <p className="mt-1 text-xs text-red-600">{errors.activity.message}</p>
            )}
          </div>
        </div>

        {submitError && (
          <div className="rounded-md bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary py-3 text-base font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {submitting ? 'Enviando solicitud...' : 'Solicitar reserva'}
        </button>
      </form>

      {/* Price sidebar */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">{room.name}</h2>
          <p className="text-sm text-gray-500">
            Tarifa base:{' '}
            <span className="font-medium text-gray-800">
              ${Number(room.basePricePerHour).toFixed(2)}/hr
            </span>
          </p>
        </div>
        <PriceBreakdown breakdown={breakdown} loading={breakdownLoading} />
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-800">
          <p className="font-semibold mb-1">ℹ Información de precios</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Recargo nocturno +30% (después de 18:00)</li>
            <li>Recargo fin de semana +30%</li>
            <li>Los recargos son aditivos, no multiplicativos</li>
            <li>El precio final se confirma al aprobar la reserva</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
