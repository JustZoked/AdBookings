# Adsemble Bookings

Sistema de reserva de salones para Adsemble, autohospedado en Ubuntu con Docker. Reconstruido desde cero a partir de la versión original en Microsoft Power Pages + Dataverse, eliminando la dependencia de licencias Premium de Microsoft.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript estricto) |
| Estilos | Tailwind CSS |
| Base de datos | PostgreSQL 16 + Prisma ORM |
| Email | Microsoft Graph API (default) / SMTP (fallback) |
| Calendario | Microsoft Graph API (Resource Mailboxes → pantallas Logitech) |
| Auth admin | Sin panel — magic links HMAC-SHA256 por correo |
| Reverse proxy | Caddy 2 (HTTPS automático Let's Encrypt) |
| Contenedores | Docker + Docker Compose v2 |
| Tests | Vitest (unit) + Playwright (E2E) |

## Cómo funciona

1. Usuario anónimo visita el sitio, elige salón y envía una solicitud.
2. `recepcion@adsemble.do` recibe un email con botones **Aprobar / Rechazar** (magic links firmados, sin login).
3. Al aprobar, se crea un evento en Exchange — el salón lo auto-acepta y las pantallas Logitech se actualizan automáticamente.
4. Al rechazar, se cancela el evento (si existía) y se notifica al solicitante.

## Setup local (desarrollo)

### Prerrequisitos
- Node.js 20+, pnpm, Docker Desktop

```bash
git clone https://github.com/TU_ORG/adsemble-bookings.git
cd adsemble-bookings
cp .env.example .env
# Editar .env: DATABASE_URL, BOOKING_ACTION_SECRET, etc.

pnpm install
pnpm prisma migrate dev
pnpm db:seed
pnpm dev
```

La app estará en `http://localhost:3000`.

### Con Docker (dev)

```bash
cp .env.example .env   # Editar según necesidad
docker compose -f docker-compose.dev.yml up --build
# En otra terminal, una vez que la DB esté lista:
docker compose -f docker-compose.dev.yml exec app npx prisma migrate deploy
docker compose -f docker-compose.dev.yml exec app npx tsx prisma/seed.ts
```

## Variables de entorno

Ver [`.env.example`](.env.example) — todas documentadas con comentarios.

Las críticas:

| Variable | Descripción |
|---|---|
| `BOOKING_ACTION_SECRET` | Clave HMAC para los magic links. Generar con `openssl rand -base64 48` |
| `MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET` | Credenciales de la app en Entra ID |
| `MS_SENDER_EMAIL` | Buzón desde el que se envían emails y se crean eventos de calendario |
| `ADMIN_NOTIFICATION_EMAIL` | Recibe las solicitudes con botones Aprobar/Rechazar |
| `CALENDAR_ENABLED` | `false` en dev (usa driver noop), `true` en producción |

## Comandos útiles

```bash
# Tests unitarios
pnpm test

# Tests E2E (requiere app corriendo)
pnpm test:e2e

# Typecheck
pnpm typecheck

# Gestión de base de datos
pnpm db:migrate      # Crear y aplicar migración nueva
pnpm db:seed         # Poblar/actualizar salones (idempotente)
pnpm db:studio       # Abrir Prisma Studio en localhost:5555
```

### Prisma Studio en producción (SSH tunnel)

```bash
# En el servidor Ubuntu
docker compose exec app npx prisma studio

# En tu máquina local (otra terminal)
ssh -L 5555:localhost:5555 usuario@tu-servidor
# Abrir: http://localhost:5555
```

## Cambios respecto a la versión Power Pages

- **Sin licencias Premium** — cero costo de plataforma más allá del servidor Ubuntu
- **Sin Power Automate** — el trigger HTTP era Premium; los emails los manda la propia app
- **Sin workarounds de Power Pages** — eliminados los patrones de "divs ocultos con Liquid" y la división de decimales por 10 que eran limitaciones de la plataforma anterior
- **Disponibilidad en BD propia** — ya no depende de consultas lentas a Dataverse
- **Magic links HMAC** — reemplazan el flujo de aprobación que antes requería login al portal

## Licencia

MIT
