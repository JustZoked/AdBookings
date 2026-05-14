'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RejectForm({ reservationId, token }: { reservationId: string; token: string }) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReject = async () => {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/reservations/${reservationId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, reason: reason.trim() || undefined }),
    })
    if (res.ok) {
      router.push(`/action/result?type=rejected&id=${reservationId}`)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Error al procesar el rechazo')
      setLoading(false)
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Motivo del rechazo{' '}
        <span className="text-gray-400 font-normal">(opcional — se envía al solicitante)</span>
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        maxLength={1000}
        placeholder="Ej: El salón ya tiene una reserva confirmada en esa franja..."
        className="mb-4 w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />
      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        onClick={handleReject}
        disabled={loading}
        className="w-full rounded-md bg-red-600 py-3 text-base font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
      >
        {loading ? 'Procesando...' : '❌ Rechazar reserva'}
      </button>
    </div>
  )
}
