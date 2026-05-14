import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const rooms = await db.room.findMany({
    where: { isActive: true },
    include: {
      amenities: { orderBy: { sortOrder: 'asc' } },
      images: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(rooms)
}
