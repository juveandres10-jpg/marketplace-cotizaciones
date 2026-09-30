# Marketplace de Cotizaciones

Plataforma para buscar/comparar productos entre proveedores y gestionar
las cotizaciones de cada uno de tus proyectos.

## Stack

- **Next.js 14** (App Router) — frontend + backend (API routes) en un solo proyecto
- **PostgreSQL** + **Prisma ORM** — base de datos
- **NextAuth.js** — autenticación (compradores y proveedores con cuenta propia)
- **Tailwind CSS** — estilos
- **Resend** (opcional) — notificaciones por email
- **Vercel Blob** (opcional) — almacenamiento de archivos adjuntos

## Modelo de datos (resumen)

- `Usuario` — pertenece a una `Empresa`; `rol` = `COMPRADOR`/`PROVEEDOR`/`ADMIN`, y `rolEmpresa` = `ADMIN_EMPRESA`/`MIEMBRO` (permisos dentro de su propia empresa)
- `Empresa` — compradora, proveedora o ambas
- `Producto` — catálogo compartido, publicado por empresas proveedoras
- `Proyecto` — pertenece a una empresa compradora; tiene su propio BOM (`ItemProyecto`)
- `Cotizacion` — RFQ de un proyecto hacia una empresa proveedora, con `ItemCotizacion`, `ArchivoCotizacion` (adjuntos) y estado:
  `BORRADOR → ENVIADA → EN_NEGOCIACION → RECIBIDA → APROBADA / DESCARTADA`

## Funcionalidades incluidas

- Registro/login con roles comprador y proveedor
- Catálogo de productos con búsqueda
- Proyectos con su propio BOM (lista de materiales)
- Solicitud y seguimiento de cotizaciones por proyecto
- **Comparador lado a lado**: compara el precio de cada ítem entre todos los proveedores que han cotizado en un proyecto, resaltando el más bajo
- **Exportar cotizaciones aprobadas a Excel o PDF**: en la página de un proyecto, cuando hay al menos una cotización en estado `APROBADA`, aparecen los botones "Exportar aprobadas a Excel" y "a PDF"
- **Selector de proveedor por nombre**: al solicitar una cotización se elige el proveedor de una lista, sin necesidad de conocer su ID
- **Notificaciones por email**: al crear una cotización o cambiar su estado, se envía un correo automático a la contraparte usando [Resend](https://resend.com). Opcional — sin `RESEND_API_KEY`, la app funciona igual y solo se omite el envío
- **Roles y permisos por empresa**: dentro de cada empresa, solo un `ADMIN_EMPRESA` puede crear proyectos, publicar productos o aprobar/descartar cotizaciones; el resto de usuarios (`MIEMBRO`) puede ver, solicitar cotizaciones y responder precios
- **Archivos adjuntos**: cada cotización admite subir fichas técnicas, PDFs, etc., usando [Vercel Blob](https://vercel.com/docs/storage/vercel-blob). Opcional — sin `BLOB_READ_WRITE_TOKEN`, el resto de la app funciona y solo se bloquea la subida de archivos con un mensaje claro
- **Multi-idioma (Español/Inglés)**: selector ES/EN en la barra de navegación, persistido en cookie
- **Sondeo diario de cotizaciones** (`/sondeo`): seguimiento en el tiempo de los precios de mercado de cada producto. Por cada producto en seguimiento se busca un mínimo de cotizaciones al día (por defecto **5**) — normalmente de Alibaba — y la app muestra faltantes, precio mínimo/promedio vs. precio de referencia, y el historial de revisiones. Pensado para alimentarse de una **tarea programada de Claude** (ver abajo) o de carga manual en `/sondeo/nueva-cotizacion`

## Sondeo diario (seguimiento de cotizaciones de mercado)

Modelo aparte del RFQ formal (`Cotizacion`): aquí los proveedores son *leads*
externos (Alibaba, etc.), no empresas registradas.

- `CotizacionMercado` — un precio/proveedor hallado para un `Producto` en una fecha.
- `RevisionDiaria` — una corrida del proceso (estado, contadores, resumen).
- `Producto.seguimientoActivo` / `Producto.minCotizaciones` — configuración por producto.

**API** (`/api/sondeo/*`): acepta sesión de navegador **o**
`Authorization: Bearer $CRON_SECRET` (token con acceso solo a estas rutas).

| Ruta | Uso |
|---|---|
| `GET /api/sondeo/worklist?dias=1` | Productos con cotizaciones faltantes en la ventana |
| `POST /api/sondeo/revisiones` · `PATCH /api/sondeo/revisiones/[id]` | Abrir / cerrar una corrida |
| `POST /api/sondeo/cotizaciones` | Carga masiva de cotizaciones de mercado |
| `GET/PATCH/DELETE /api/sondeo/cotizaciones[/id]` | Consultar / corregir |
| `PATCH /api/sondeo/productos/[id]` | Activar seguimiento / cambiar el mínimo |

**CIF estimado:** `Producto.fleteEstimadoUnit` (+ `fleteEstimadoDestino`,
`fleteEstimadoNotas`) — el usuario ingresa su tarifa real de flete/seguro por
unidad (nunca se inventa). Con eso la app calcula un "CIF estimado" = precio +
flete, solo sobre cotizaciones en la misma moneda del producto (no se mezclan
monedas sin una tasa de cambio real). Se configura desde `/sondeo/producto/[id]`,
se ve en esa página y en la exportación a Excel.

**Exportar a Excel:** `GET /api/sondeo/exportar?productoId=&dias=` — hoja
"Cotizaciones" (detalle + CIF estimado) y hoja "Documentos soporte" (enlaces de
origen de cada precio, como respaldo/evidencia).

**Automatización:** `docs/sondeo-runbook.md` (procedimiento paso a paso, también
usable como prompt de la tarea programada) y `docs/sondeo-fase2-despliegue.md`
(desplegar en Vercel + crear la routine con `/schedule`).

Variables nuevas en `.env` (ver `.env.example`): `CRON_SECRET`, `APP_URL`.

## Instalación local

1. **Instalar dependencias**

   ```bash
   npm install
   ```

2. **Levantar una base de datos PostgreSQL.** Opciones rápidas:
   - Local con Docker: `docker run --name marketplace-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=marketplace -p 5432:5432 -d postgres:16`
   - O usar un servicio gratuito: [Neon](https://neon.tech), [Supabase](https://supabase.com), [Railway](https://railway.app)

3. **Configurar variables de entorno**

   ```bash
   cp .env.example .env
   ```
   Edita `.env` con tu `DATABASE_URL` real. Genera `NEXTAUTH_SECRET` con:
   ```bash
   openssl rand -base64 32
   ```
   `RESEND_API_KEY`/`EMAIL_FROM` y `BLOB_READ_WRITE_TOKEN` son opcionales para desarrollo local (ver detalle en cada sección de despliegue más abajo).

4. **Crear las tablas en la base de datos**

   ```bash
   npx prisma migrate dev --name init
   ```

5. **(Opcional) Cargar datos de ejemplo**

   ```bash
   npm run db:seed
   ```
   Esto crea:
   - Usuario comprador (admin de su empresa): `comprador@oasis.com` / `123456`
   - Usuario proveedor: `ventas@solaire.com` / `123456`
   - Un proyecto de ejemplo ("Granja Solar 1ha") con BOM, dos cotizaciones recibidas y una aprobada (para poder probar el comparador y la exportación de inmediato)

6. **Iniciar en modo desarrollo**

   ```bash
   npm run dev
   ```
   Abre http://localhost:3000

## Despliegue en producción (guía paso a paso — Vercel)

Esta es la ruta más simple porque Vercel es quien construye el proyecto de Next.js,
y además ofrece tanto el Blob storage como fácil integración con Postgres.

### 1. Sube el proyecto a GitHub

```bash
cd marketplace-app
git init
git add .
git commit -m "Marketplace de cotizaciones"
```
Crea un repositorio vacío en GitHub y sigue las instrucciones de `git remote add origin ...` / `git push`.

### 2. Crea la base de datos PostgreSQL

Cualquiera de estas opciones tiene plan gratuito:
- **[Neon](https://neon.tech)** (recomendado, serverless, integración directa con Vercel)
- **[Supabase](https://supabase.com)**
- **Vercel Postgres** (Storage → Create Database → Postgres, dentro del mismo proyecto de Vercel)

Copia el `DATABASE_URL` que te den — lo necesitas en el paso 4.

### 3. Importa el proyecto en Vercel

1. Entra a [vercel.com](https://vercel.com) → **Add New → Project** → selecciona tu repositorio de GitHub.
2. Framework Preset: Vercel detecta Next.js automáticamente.
3. En **Build Command**, reemplaza el valor por defecto con:
   ```
   prisma generate && prisma migrate deploy && next build
   ```
   (esto aplica las migraciones automáticamente en cada despliegue)

### 4. Configura las variables de entorno en Vercel

En **Settings → Environment Variables** del proyecto, agrega:

| Variable | Valor | Obligatoria |
|---|---|---|
| `DATABASE_URL` | La cadena de conexión del paso 2 | Sí |
| `NEXTAUTH_SECRET` | Genera uno con `openssl rand -base64 32` | Sí |
| `NEXTAUTH_URL` | Tu dominio de producción, ej. `https://tu-app.vercel.app` | Sí |
| `RESEND_API_KEY` | Ver paso 5 | No |
| `EMAIL_FROM` | Ver paso 5 | No |
| `BLOB_READ_WRITE_TOKEN` | Ver paso 6 | No |

### 5. (Opcional) Activa las notificaciones por email con Resend

1. Crea una cuenta gratuita en [resend.com](https://resend.com).
2. En **API Keys**, genera una clave y ponla en `RESEND_API_KEY`.
3. Para `EMAIL_FROM`, mientras no verifiques un dominio propio puedes usar el dominio de pruebas de Resend: `onboarding@resend.dev` (solo te deja enviar a tu propio email registrado en Resend). Para enviar a cualquier destinatario, verifica tu dominio en **Domains** dentro de Resend y usa una dirección de ese dominio (ej. `notificaciones@tuempresa.com`).

Sin esta variable configurada, la app sigue funcionando normal — solo se omiten los correos.

### 6. (Opcional) Activa los archivos adjuntos con Vercel Blob

1. Dentro de tu proyecto en Vercel: **Storage → Create → Blob**.
2. Al crearlo y conectarlo a tu proyecto, Vercel agrega automáticamente la variable `BLOB_READ_WRITE_TOKEN` — no necesitas copiarla a mano en producción.
3. Para poder subir archivos también en tu entorno local, ve a **Storage → tu Blob store → .env.local** y copia el token a tu archivo `.env`.

Sin esta variable, el resto de la app funciona normal — solo se bloquea la subida de archivos con un mensaje explicativo.

### 7. Despliega

Con todo configurado, dale a **Deploy**. Los siguientes pushes a la rama principal desplegarán automáticamente (y correrán las migraciones gracias al build command del paso 3).

### 8. (Opcional) Carga los datos de ejemplo en producción

Desde tu máquina local, apuntando temporalmente tu `.env` a la `DATABASE_URL` de producción:
```bash
npm run db:seed
```
(Hazlo una sola vez; si lo repites, creará datos duplicados.)

---

**Alternativa: servidor propio (VPS)**

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start   # sirve en el puerto 3000 (usa pm2 o systemd para mantenerlo corriendo)
```
En este caso, para archivos adjuntos necesitarás reemplazar `@vercel/blob` por otro
proveedor de almacenamiento (ej. S3, Cloudflare R2) en `src/app/api/cotizaciones/[id]/archivos/route.ts`,
ya que Vercel Blob solo emite tokens dentro de la infraestructura de Vercel.

## Próximos pasos sugeridos

- Invitar usuarios adicionales a una empresa ya existente (hoy solo se define `rolEmpresa` al registrarse)
- Página de administración para editar el catálogo de productos ya publicados
- Ampliar cobertura del multi-idioma a mensajes de error del backend

> El mercadeo automatizado ahora es una app independiente: **Marketing Oasis** (repositorio `marketingoasis`).
