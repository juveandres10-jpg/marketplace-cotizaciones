# Fase 2 — Desplegar en Vercel y programar el sondeo diario

La tarea programada de Claude ("routine") corre **en la nube de Claude**, no en
tu equipo. Para que pueda llamar a `/api/sondeo/*`, la app debe estar desplegada
con **URL pública** y con `CRON_SECRET` configurado.

El repositorio git ya está inicializado en `marketplace-app/` con un primer commit.

---

## Opción A — Vercel CLI (sin GitHub, más rápido)

Desde `marketplace-app/`:

```bash
# 1. Autenticarte (abre el navegador con tu cuenta de Vercel)
npx vercel login

# 2. Primer deploy (crea el proyecto). Responde:
#    - Set up and deploy? Y
#    - Which scope? tu cuenta
#    - Link to existing project? N
#    - Project name? marketplace-cotizaciones
#    - In which directory is your code located? ./
#    - Override build command? Y ->  prisma generate && prisma migrate deploy && next build
#    - Override output/dev? N
npx vercel

# 3. Anota la URL que te da (ej. https://marketplace-cotizaciones.vercel.app)
#    y carga las variables de entorno (production):
npx vercel env add DATABASE_URL production
npx vercel env add NEXTAUTH_SECRET production
npx vercel env add NEXTAUTH_URL production
npx vercel env add CRON_SECRET production
npx vercel env add APP_URL production

# 4. Deploy final a producción con las variables ya cargadas
npx vercel --prod
```

### Valores para las variables (production)

| Variable | Valor |
|---|---|
| `DATABASE_URL` | El connection string de Neon **ya rotado** (Settings → Reset password en Neon). |
| `NEXTAUTH_SECRET` | `3jzyCi8iHNSKipd4JoUr4j4+8nit+5UziP6n+ATxXss=` (generado para prod; o el tuyo con `openssl rand -base64 32`). |
| `NEXTAUTH_URL` | La URL pública exacta, ej. `https://marketplace-cotizaciones.vercel.app` |
| `CRON_SECRET` | `929b6db775e7ca24fe0f83fd64edb86c8285b7a01a36602a3b33a02c53b4e113` (nuevo, **distinto** al de desarrollo). |
| `APP_URL` | La misma URL pública que `NEXTAUTH_URL`. |

> Estos secretos se generaron en esta sesión. Si prefieres, reemplázalos por
> otros — solo asegúrate de usar el mismo `CRON_SECRET` aquí y en la routine.

---

## Opción B — GitHub + dashboard de Vercel

1. Crea un repo vacío en GitHub y súbelo:
   ```bash
   git remote add origin https://github.com/<tu-usuario>/marketplace-cotizaciones.git
   git push -u origin master
   ```
2. [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo.
3. **Root Directory:** `./` (el repo ya es `marketplace-app`).
4. **Build Command** (override):
   `prisma generate && prisma migrate deploy && next build`
5. **Environment Variables:** las 5 de la tabla de arriba.
6. **Deploy.** Los siguientes `git push` a `master` redesplegarán solos.

---

## 2. Probar la API en producción

```bash
curl -s -H "Authorization: Bearer 929b6db775e7ca24fe0f83fd64edb86c8285b7a01a36602a3b33a02c53b4e113" \
  "https://TU-URL.vercel.app/api/sondeo/worklist?dias=1"
```

Debe responder un JSON con `items`. Si da 401, revisa `CRON_SECRET`.
La migración `20260910234333_sondeo_diario` se aplica sola en el build.

---

## 3. Crear la tarea programada

En una sesión de Claude Code sobre este proyecto, di:
**"crea la routine del sondeo diario"** — o ejecuta `/schedule` — con:

- **Frecuencia:** `0 8 * * 1-5` en `America/Bogota` (Lun–Vie 08:00).
- **Prompt:** el contenido de la sección "Procedimiento" de
  `docs/sondeo-runbook.md`, anteponiendo:

  ```
  APP_URL = https://TU-URL.vercel.app
  CRON_SECRET = 929b6db775e7ca24fe0f83fd64edb86c8285b7a01a36602a3b33a02c53b4e113
  Usa el header  Authorization: Bearer <CRON_SECRET>  en todas las llamadas.
  ```

---

## 4. Verificar

- Tras la primera corrida, revisa `/sondeo`: debe aparecer una entrada en
  "Revisiones recientes" y cotizaciones nuevas por producto.
- Si el estado queda `PARCIAL` seguido por captcha de Alibaba:
  - Baja el volumen (menos productos en seguimiento por día).
  - Completa esos productos a mano en `/sondeo/nueva-cotizacion`.
  - Evalúa un servicio externo de datos de Alibaba.

---

## Mientras tanto (sin desplegar)

Ejecuta la revisión **hoy**, manualmente, en una sesión de Claude Code: pide
seguir `docs/sondeo-runbook.md` con `APP_URL=http://localhost:3000` y el
`CRON_SECRET` de tu `.env`, con la app corriendo (`npm run dev`).
