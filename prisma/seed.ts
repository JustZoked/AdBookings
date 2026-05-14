import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const rooms = [
  {
    name: 'Brickland',
    slug: 'brickland',
    roomEmail: 'Brickland@adsemble.do',
    basePricePerHour: 100.0,
    minAdvanceHours: 24,
    capacity: null,
    isActive: true,
    description:
      'Este salón cuenta con un amplio y versátil espacio, ideal para ' +
      'capacitaciones, conferencias y presentaciones grupales. Dispone de ' +
      'múltiples mesas y asientos cómodos, una pantalla para proyección, ' +
      'sistema de climatización y un área de apoyo tipo lounge, ofreciendo ' +
      'un ambiente moderno y funcional para actividades dinámicas y colaborativas.',
    amenities: [
      { label: '📺 Smart TV', price: 0, sortOrder: 1 },
      { label: '📹 Video Conferencing', price: 30, sortOrder: 2 },
    ],
    images: [
      'https://salones-ads.s3.us-east-2.amazonaws.com/Brickland+1.jpeg',
      'https://salones-ads.s3.us-east-2.amazonaws.com/Brickland+2.jpeg',
      'https://salones-ads.s3.us-east-2.amazonaws.com/Brickland+3.jpeg',
    ],
  },
  {
    name: 'Connector',
    slug: 'connector',
    roomEmail: 'Connector@adsemble.do',
    basePricePerHour: 20.0,
    minAdvanceHours: 24,
    capacity: null,
    isActive: true,
    description:
      'Este salón brinda un espacio cómodo y funcional para reuniones de ' +
      'equipo y sesiones de trabajo. Dispone de una mesa de conferencias, ' +
      'sillas ergonómicas, pantalla para presentaciones y un área de descanso, ' +
      'creando un entorno versátil para reuniones productivas.',
    amenities: [
      { label: '📺 Smart TV', price: 0, sortOrder: 1 },
      { label: '📝 Whiteboard', price: 0, sortOrder: 2 },
    ],
    images: [
      'https://salones-ads.s3.us-east-2.amazonaws.com/Connector+1.jpeg',
      'https://salones-ads.s3.us-east-2.amazonaws.com/Connector+2.jpeg',
      'https://salones-ads.s3.us-east-2.amazonaws.com/Connector+3.jpeg',
    ],
  },
  {
    name: 'Master Builders',
    slug: 'master-builders',
    roomEmail: 'Masterbuilders@adsemble.do',
    basePricePerHour: 20.0,
    minAdvanceHours: 24,
    capacity: null,
    isActive: true,
    description:
      'Este salón ofrece un ambiente moderno y elegante, ideal para reuniones ' +
      'ejecutivas y presentaciones. Cuenta con una mesa amplia, sillas ' +
      'ergonómicas y una pantalla para proyecciones, complementado con una ' +
      'iluminación cálida que favorece la concentración y el trabajo colaborativo.',
    amenities: [
      { label: '📺 Smart TV', price: 0, sortOrder: 1 },
      { label: '📝 Whiteboard', price: 0, sortOrder: 2 },
    ],
    images: [
      'https://salones-ads.s3.us-east-2.amazonaws.com/Master+Builders+1.jpeg',
      'https://salones-ads.s3.us-east-2.amazonaws.com/Masterbuilders+2.jpeg',
      'https://salones-ads.s3.us-east-2.amazonaws.com/Master+Builders+3.jpeg',
    ],
  },
]

async function main() {
  console.log('Seeding database...')

  for (const roomData of rooms) {
    const { amenities, images, ...roomFields } = roomData

    const room = await prisma.room.upsert({
      where: { slug: roomFields.slug },
      update: {
        ...roomFields,
        basePricePerHour: roomFields.basePricePerHour,
      },
      create: {
        ...roomFields,
        basePricePerHour: roomFields.basePricePerHour,
      },
    })

    // Delete existing amenities and images to re-seed cleanly
    await prisma.amenity.deleteMany({ where: { roomId: room.id } })
    await prisma.roomImage.deleteMany({ where: { roomId: room.id } })

    await prisma.amenity.createMany({
      data: amenities.map((a) => ({
        roomId: room.id,
        label: a.label,
        price: a.price,
        sortOrder: a.sortOrder,
      })),
    })

    await prisma.roomImage.createMany({
      data: images.map((url, idx) => ({
        roomId: room.id,
        url,
        sortOrder: idx + 1,
      })),
    })

    console.log(`  Upserted room: ${room.name}`)
  }

  console.log('Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
