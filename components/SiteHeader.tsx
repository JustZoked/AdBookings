import Link from 'next/link'
import Image from 'next/image'

const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? 'm.molina@adsemble.do'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-primary text-lg">
          <Image src="/logo.png" alt="Adsemble" width={60} height={60} className="object-contain" />
          <span>Adsemble Bookings</span>
        </Link>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-white transition-colors"
        >
          Contacto
        </a>
      </div>
    </header>
  )
}
