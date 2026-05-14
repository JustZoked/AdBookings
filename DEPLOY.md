# Guía de despliegue — Ubuntu 22.04 / 24.04

## Prerrequisitos

- Servidor Ubuntu 22.04 o 24.04 con IP pública
- Dominio apuntando al servidor (`A record`: `reservas.adsemble.do → IP_DEL_SERVIDOR`)
- Puerto 80 y 443 abiertos en el firewall
- App registrada en Entra ID con permisos `Mail.Send` y `Calendars.ReadWrite` (ver sección Microsoft 365)

---

## 1. Instalar Docker y Docker Compose

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# Verificar
docker --version          # Docker 24+
docker compose version    # Docker Compose v2.x
```

---

## 2. Clonar el repositorio y configurar

```bash
git clone https://github.com/TU_ORG/adsemble-bookings.git
cd adsemble-bookings

# Crear el archivo de entorno
cp .env.example .env
nano .env   # Editar con los valores reales (ver sección Variables de entorno)
```

### Generar BOOKING_ACTION_SECRET

```bash
openssl rand -base64 48
# Pegar el resultado en .env como BOOKING_ACTION_SECRET
```

### Crear directorios necesarios

```bash
mkdir -p uploads backups
```

---

## 3. Primer arranque

```bash
# Construir imagen y arrancar todos los servicios
docker compose up -d --build

# Verificar que todos los contenedores estén Running
docker compose ps

# Ver logs de la app mientras arranca
docker compose logs -f app
```

Caddy obtendrá el certificado TLS automáticamente la primera vez que alguien acceda.

---

## 4. Inicializar la base de datos

```bash
# Aplicar migraciones (también se ejecuta automáticamente al arrancar el contenedor)
docker compose exec app npx prisma migrate deploy

# Cargar los salones iniciales
docker compose exec app npx tsx prisma/seed.ts
```

---

## 5. Verificar HTTPS

Abrir `https://reservas.adsemble.do` en el navegador. Debería mostrar el certificado válido y la página principal con los tres salones.

Si el certificado tarda, ver logs de Caddy:
```bash
docker compose logs caddy
```

---

## Operación diaria

### Ver logs

```bash
docker compose logs -f app       # App Next.js
docker compose logs -f caddy     # Reverse proxy
docker compose logs -f db        # PostgreSQL
```

### Reiniciar un servicio

```bash
docker compose restart app
```

### Actualizar a nueva versión

```bash
git pull
docker compose up -d --build
```

---

## Backup manual

```bash
# Ejecutar backup ahora mismo
docker compose exec backup sh /backup.sh

# Ver backups disponibles
ls -lh backups/

# Restaurar un backup específico
cat backups/adsemble_20260518_020000.sql.gz | gunzip | \
  docker compose exec -T db psql -U adsemble -d adsemble
```

Los backups automáticos se ejecutan cada noche a las 02:00 y se guardan en `./backups/`. Se rotan los mayores de 14 días.

---

## Gestión de salones (Prisma Studio)

Los salones se gestionan directamente en la base de datos. No hay panel de admin con login.

### Desde el servidor

```bash
docker compose exec app npx prisma studio
# Abre en http://localhost:5555 (solo accesible desde localhost del servidor)
```

### Acceso remoto con SSH tunnel

```bash
# En tu máquina local:
ssh -L 5555:localhost:5555 usuario@reservas.adsemble.do

# Mientras el tunnel está activo, abrir en el navegador:
# http://localhost:5555
```

---

## Configuración de Microsoft 365

### App registration en Entra ID

1. Ir a **portal.azure.com → Azure Active Directory → App registrations → New registration**
2. Nombre: `Adsemble Bookings`; tipo: `Single tenant`
3. En **Certificates & secrets**, crear un nuevo **Client secret**
4. En **API permissions**, agregar:
   - `Microsoft Graph → Application permissions → Mail.Send`
   - `Microsoft Graph → Application permissions → Calendars.ReadWrite`
5. Click en **Grant admin consent** para ambos permisos
6. Copiar **Directory (tenant) ID**, **Application (client) ID** y el **Value** del secret a `.env`

### Application Access Policy (limitar alcance a los buzones necesarios)

Ejecutar en PowerShell con Exchange Online conectado:

```powershell
Connect-ExchangeOnline

# Crear grupo de seguridad con los buzones permitidos
New-DistributionGroup -Name "AdsembleBookingsScope" -Type "Security" `
  -PrimarySmtpAddress "adsemble-scope@adsemble.do"

# Agregar buzón remitente (TEMP durante pruebas)
Add-DistributionGroupMember -Identity "adsemble-scope@adsemble.do" `
  -Member "m.molina@adsemble.do"

# Salones (Resource Mailboxes)
Add-DistributionGroupMember -Identity "adsemble-scope@adsemble.do" -Member "Brickland@adsemble.do"
Add-DistributionGroupMember -Identity "adsemble-scope@adsemble.do" -Member "Connector@adsemble.do"
Add-DistributionGroupMember -Identity "adsemble-scope@adsemble.do" -Member "Masterbuilders@adsemble.do"

# Aplicar policy
New-ApplicationAccessPolicy -AppId "<MS_CLIENT_ID>" `
  -PolicyScopeGroupId "adsemble-scope@adsemble.do" `
  -AccessRight RestrictAccess `
  -Description "Restrict Adsemble Bookings to reception + room mailboxes only"

# Verificar
Test-ApplicationAccessPolicy -Identity "m.molina@adsemble.do" -AppId "<MS_CLIENT_ID>"
Test-ApplicationAccessPolicy -Identity "Brickland@adsemble.do" -AppId "<MS_CLIENT_ID>"
```

### Configurar Resource Mailboxes para auto-aceptar

```powershell
$rooms = @("Brickland@adsemble.do", "Connector@adsemble.do", "Masterbuilders@adsemble.do")
foreach ($room in $rooms) {
    Set-CalendarProcessing -Identity $room `
      -AutomateProcessing AutoAccept `
      -AllowConflicts $false `
      -DeleteComments $false `
      -DeleteSubject $false `
      -AddOrganizerToSubject $false
}
```

---

## Switch de pruebas a producción

Durante el desarrollo y pruebas, todos los emails salen y llegan a `m.molina@adsemble.do`. Cuando esté listo para producción, seguir estos pasos:

### Paso 1: Actualizar `.env` en el servidor

```bash
nano .env
```

Cambiar estas cuatro variables:
```
MS_SENDER_EMAIL=recepcion@adsemble.do
CONTACT_EMAIL=recepcion@adsemble.do
ADMIN_NOTIFICATION_EMAIL=recepcion@adsemble.do
SMTP_FROM="Adsemble Bookings <recepcion@adsemble.do>"
```

### Paso 2: Agregar recepcion@adsemble.do al Application Access Policy

```powershell
Add-DistributionGroupMember -Identity "adsemble-scope@adsemble.do" `
  -Member "recepcion@adsemble.do"

# Verificar
Test-ApplicationAccessPolicy -Identity "recepcion@adsemble.do" -AppId "<MS_CLIENT_ID>"
# Esperado: AccessCheckResult: Granted
```

### Paso 3: Reiniciar la app para tomar los nuevos env vars

```bash
docker compose restart app
```

### Paso 4: Verificación final

1. Hacer una reserva de prueba desde el sitio
2. Verificar que `recepcion@adsemble.do` recibe el email con los botones Aprobar/Rechazar
3. Aprobar → verificar que se crea el evento en el calendario del salón
4. Las pantallas Logitech deben reflejar el cambio automáticamente

### Nota sobre reservas existentes

Los `graphEventId` guardados en la BD apuntan al organizador original (`m.molina@adsemble.do`). Las cancelaciones de esas reservas antiguas usarán ese buzón, lo cual seguirá funcionando. Las nuevas reservas usarán `recepcion@adsemble.do`. No es necesario migrar las reservas existentes.

---

## Troubleshooting

### El certificado TLS no se genera

```bash
# Verificar que el DNS apunta al servidor
dig reservas.adsemble.do A

# Verificar que los puertos 80/443 están accesibles
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Error de Graph API 401/403

1. Verificar que los permisos `Mail.Send` y `Calendars.ReadWrite` tienen **Grant admin consent** (fondo verde en el portal de Azure)
2. Verificar que la Application Access Policy está aplicada: `Test-ApplicationAccessPolicy`
3. Revisar que `MS_SENDER_EMAIL` es exactamente el UPN del buzón (sensible a mayúsculas)

### Email no llega

```bash
# Ver logs de la app buscando errores de mailer
docker compose logs app | grep -i "mailer\|email\|graph"

# Ver emailLastError en la base de datos
docker compose exec db psql -U adsemble -d adsemble \
  -c "SELECT id, status, email_sent, email_last_error FROM reservations ORDER BY created_at DESC LIMIT 5;"
```

### La pantalla Logitech no se actualiza

1. Verificar que el Resource Mailbox del salón tiene `AutomateProcessing = AutoAccept`
2. Verificar que el `graphEventId` fue guardado: revisar en Prisma Studio
3. Si `graphEventLastError` tiene contenido, usar el link de reintento que llegó al email de admin
