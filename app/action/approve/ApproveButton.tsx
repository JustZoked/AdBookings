'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ApproveButton({
  reservationId,
  token,
}: {
  reservationId: string
  token: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async () => {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/reservations/${reservationId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (res.ok) {
      router.push(`/action/result?type=approved&id=${reservationId}`)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Error al procesar la aprobación')
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        onClick={handleApprove}
        disabled={loading}
        className="w-full rounded-md bg-green-600 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
      >
        {loading ? 'Procesando...' : '✅ Confirmar aprobación'}
      </button>
    </div>
  )
}
