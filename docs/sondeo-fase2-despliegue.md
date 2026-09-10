# Fase 2 — Desplegar y programar el sondeo diario

La tarea programada de Claude ("routine") corre **en la nube de Claude**, no en
tu equipo. Para que pueda llamar a `/api/sondeo/*`, la app debe estar desplegada
con **URL pública** y con `CRON_SECRET` configurado.

## 1. Desplegar en Vercel

Sigue el `README.md` (sección "Despliegue en producción — Vercel"). Además de las
variables que ya lista, agrega en **Settings → Environment Variables**:

| Variable | Valor |
|---|---|
| `CRON_SECRET` | Genera uno nuevo: `openssl rand -hex 32`. **No reutilices** el de desarrollo. |
| `APP_URL` | Tu dominio de producción, ej. `https://tu-app.vercel.app` |

La migración `20260910234333_sondeo_diario` se aplica sola en el deploy si tu
Build Command es `prisma generate && prisma migrate deploy && next build`.

## 2. Probar la API en producción

```bash
curl -s -H "Authorization: Bearer <CRON_SECRET_DE_PROD>" \
  "https://tu-app.vercel.app/api/sondeo/worklist?dias=1"
```

Debe responder un JSON con `items`. Si da 401, revisa el `CRON_SECRET`.

## 3. Crear la tarea programada

En una sesión de Claude Code sobre este proyecto:

```
/schedule
```

Configuración sugerida:

- **Frecuencia:** diaria, de lunes a viernes, ~08:00 (hora de Colombia, `America/Bogota`).
- **Prompt:** el contenido de la sección "Procedimiento" de `docs/sondeo-runbook.md`,
  anteponiendo estas dos líneas con los valores reales:

  ```
  APP_URL = https://tu-app.vercel.app
  El CRON_SECRET está en la variable de entorno CRON_SECRET de la routine.
  ```

- **Secret de la routine:** guarda `CRON_SECRET` como variable/secret de la
  propia tarea programada para que no quede en texto plano en el prompt.

## 4. Verificar

- Tras la primera corrida, revisa `/sondeo` en la app: debe aparecer una entrada
  en "Revisiones recientes" y las cotizaciones nuevas por producto.
- Si el estado queda `PARCIAL` de forma recurrente por captcha de Alibaba,
  considera:
  - Bajar el volumen (menos productos en seguimiento por día).
  - Completar esos productos a mano desde `/sondeo/nueva-cotizacion`.
  - Evaluar la opción de un servicio externo de datos (ver la conversación inicial).

## Mientras tanto (sin desplegar)

Puedes ejecutar la revisión **hoy**, manualmente, en una sesión de Claude Code:
pídele que siga `docs/sondeo-runbook.md` con `APP_URL=http://localhost:3000` y el
`CRON_SECRET` de tu `.env`. Necesitas la app corriendo (`npm run dev`).
