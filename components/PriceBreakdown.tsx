'use client'

import type { PriceBreakdown as PriceBreakdownType } from '@/lib/pricing'

interface PriceBreakdownProps {
  breakdown: PriceBreakdownType | null
  loading?: boolean
}

export function PriceBreakdown({ breakdown, loading }: PriceBreakdownProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-white p-4">
        <h3 className="mb-3 font-semibold text-gray-900">Precio estimado</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      </div>
    )
  }

  if (!breakdown) {
    return (
      <div className="rounded-lg border border-border bg-white p-4">
        <h3 className="mb-2 font-semibold text-gray-900">Precio estimado</h3>
        <p className="text-sm text-gray-500">
          Selecciona fecha y horario para ver el desglose de precio.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <h3 className="mb-3 font-semibold text-gray-900">Desglose de precio</h3>
      <div className="space-y-1">
        {breakdown.lines.slice(0, -1).map((line, i) => (
          <div key={i} className="flex items-start justify-between gap-2 text-sm">
            <span className="text-gray-600">{line.split(' = ')[0]}</span>
            <span className="shrink-0 font-medium text-gray-800">
              {line.split(' = ')[1] ?? ''}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t pt-3 flex items-center justify-between">
        <span className="font-bold text-gray-900">Total estimado</span>
        <span className="text-xl font-bold text-primary">
          ${breakdown.grandTotal.toFixed(2)}
        </span>
      </div>
      {breakdown.weekendApplied && (
        <p className="mt-2 text-xs text-amber-600">
          ⚠ Recargo de fin de semana aplicado (+30%)
        </p>
      )}
      {breakdown.nightHours > 0 && (
        <p className="mt-1 text-xs text-blue-600">
          🌙 {breakdown.nightHours.toFixed(1)}h nocturnas (después 18:00)
        </p>
      )}
    </div>
  )
}
