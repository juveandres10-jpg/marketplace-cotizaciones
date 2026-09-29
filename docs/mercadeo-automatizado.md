# Mercadeo automatizado (constructora)

Módulo `/mercadeo`: analiza cómo están Facebook e Instagram, propone el plan de
la semana (cuándo publicar, cuántas veces pautar y con cuánto), genera las
piezas (imagen + copy + guion de video), lo envía por correo para aprobación y,
**solo cuando se aprueba**, lo programa y crea la pauta en Meta.

## Flujo

1. **Proyecto en venta** (`/mercadeo/proyectos/nuevo`): nombre, ciudad, precio
   desde, áreas, amenidades, diferenciales, WhatsApp, landing, render y
   presupuesto semanal. Es la única fuente de datos para los copies: la app no
   inventa precios, subsidios ni fechas.
2. **Métricas**: botón *Sincronizar con Meta* (publicaciones de la Página,
   media de Instagram, resultados de anuncios y seguidores) o carga CSV en
   `/mercadeo/metricas` (export de Meta Business Suite).
3. **Análisis** (`src/lib/mercadeo/analisis.ts`, últimos 90 días):
   - KPIs por red: alcance, tasa de interacción, CTR, contactos (leads +
     mensajes), inversión y costo por contacto.
   - Mejor formato (puntaje orgánico ponderando clics, mensajes y leads).
   - Mejores franjas día/hora en hora local (suavizado bayesiano para que una
     sola publicación con suerte no domine). Si faltan datos se completan con
     franjas de referencia del sector, marcadas como tales.
   - Frecuencia semanal por red (IG 4 / FB 3 de base, ajustada por
     desempeño y subiendo de forma gradual si hoy se publica poco).
   - Pautas: `presupuesto / MERCADEO_MIN_PRESUPUESTO_PAUTA` (1 a 4) y reparto
     entre redes proporcional a 1/costo-por-contacto (piso 20%). Sin historial
     suficiente: 55% IG / 45% FB, con aviso.
   - Nivel de confianza (baja/media/alta) según la cantidad de datos.
4. **Plan semanal** (`planificador.ts` + `estrategia.ts`): calendario de la
   próxima semana con tema comercial, formato, objetivo, titular, copy, CTA,
   hashtags, concepto visual y guion (reels/videos). Con `ANTHROPIC_API_KEY` lo
   redacta Claude (salida JSON validada); sin clave, plantillas.
5. **Fotos y renders**: en la página del proyecto (`/mercadeo/proyectos/[id]`)
   se suben a Vercel Blob (subida directa desde el navegador, hasta 20 MB por
   imagen, máx. 100). Cada pieza usa una imagen distinta de la galería, en orden;
   la primera es la principal. Requiere `BLOB_READ_WRITE_TOKEN`.
6. **Piezas gráficas** (`imagen.tsx`): PNG 1080×1080 (feed) o 1080×1920
   (reel/historia) con el render del proyecto de fondo, titular, precio desde,
   CTA y contacto. `GET /api/mercadeo/piezas/[id]/imagen`.
7. **Aprobación por correo**: informe completo (estado de las redes,
   estrategia, calendario con miniaturas, inversión) con enlace de un solo uso
   que vence en 7 días. Quien aprueba no necesita cuenta. Aprobar exige un clic
   (POST), no basta con abrir el enlace. Rechazar exige comentario; el equipo
   edita las piezas y reenvía (el enlace anterior deja de servir).
8. **Publicación en Meta** al aprobar (`meta.ts`):
   - Piezas pagadas → campaña (categoría especial *HOUSING*), conjunto de
     anuncios con presupuesto total y fechas, segmentación por radio alrededor
     del proyecto (mín. 25 km), imagen, creativo y anuncio. **Quedan en pausa**
     salvo `META_ACTIVAR_AL_APROBAR=true`.
   - Orgánicas de Facebook → programadas en la Página a la fecha/hora del plan.
   - Orgánicas de Instagram → en cola; la API no permite programar, así que la
     tarea automática las publica cuando llega la hora.

## Pago de la pauta

La app no maneja tarjetas ni pagos: Meta cobra la pauta al método de pago
configurado en la cuenta publicitaria (Business Manager → Facturación). La app
solo crea los anuncios con el presupuesto aprobado. Controles:
`MERCADEO_TOPE_PRESUPUESTO_SEMANAL` (tope duro) y anuncios en pausa por defecto.

## Tarea automática

`POST /api/mercadeo/automatizar` con `Authorization: Bearer $MERCADEO_CRON_SECRET`
(opera sobre `MERCADEO_EMPRESA_ID`). Body opcional `{"acciones": [...]}`:

| Acción | Qué hace | Frecuencia sugerida |
|---|---|---|
| `sincronizar` | trae métricas frescas de Meta | con `planificar` |
| `planificar` | genera el plan de la próxima semana por cada proyecto activo (si no existe) y lo envía a `MERCADEO_EMAIL_APROBACION` | jueves/viernes |
| `publicar` | publica en Instagram las piezas aprobadas cuya hora llegó | cada hora |

Ejemplo (cualquier scheduler: Vercel Cron, GitHub Actions, rutina de Claude):

```bash
curl -X POST "$APP_URL/api/mercadeo/automatizar" \
  -H "Authorization: Bearer $MERCADEO_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"acciones":["sincronizar","planificar"]}'
```

## Cuenta única de la empresa: oasissas8@gmail.com

Todo el módulo se maneja con el correo de las redes sociales de la empresa,
`oasissas8@gmail.com`:

| Servicio | Qué hacer con ese correo |
|---|---|
| Meta Business Manager | Debe ser administrador de la Página de Facebook, la cuenta de Instagram y la cuenta publicitaria (y el método de pago de la pauta). Desde ahí se crea el usuario del sistema y el token `META_ACCESS_TOKEN`. |
| Aprobación de planes | `MERCADEO_EMAIL_APROBACION="oasissas8@gmail.com"`: ahí llega cada plan semanal para aprobar o rechazar. |
| Envío de correos (Resend) | Crear la cuenta de Resend con ese correo. Así, sin verificar un dominio propio, se puede usar `EMAIL_FROM="onboarding@resend.dev"`: Resend solo entrega al correo dueño de la cuenta, que es justamente quien aprueba. Un Gmail no se puede usar como remitente en Resend. |
| Claude (opcional) | Crear la cuenta de la API de Anthropic con ese correo para obtener `ANTHROPIC_API_KEY`. |
| Usuario de la app | Registrar ese correo como usuario administrador de la empresa en el marketplace. |

Si más adelante se aprueba desde otros correos (por ejemplo gerencia), hay que
verificar un dominio propio en Resend y agregarlos separados por coma.

## Configurar Meta

1. Business Manager → Usuarios del sistema → crear uno con acceso a la Página,
   la cuenta de Instagram y la cuenta publicitaria; generar token con permisos
   `pages_read_engagement, pages_read_user_content, pages_manage_posts, instagram_basic,
   instagram_content_publish, instagram_manage_insights, ads_management, ads_read`.
2. Copiar `META_PAGE_ID`, `META_IG_USER_ID` (cuenta de Instagram profesional
   vinculada a la Página) y `META_AD_ACCOUNT_ID`.
3. `APP_URL` debe ser la URL pública: Instagram descarga las imágenes desde
   `/api/mercadeo/piezas/[id]/imagen`.

## Limitaciones conocidas

- Los reels/videos se entregan como guion + imagen; la app no renderiza video.
  Mientras no se cargue un video, esas piezas se publican/pautan con la imagen.
- La pauta usa objetivo *Tráfico* (o *Alcance*) hacia la landing o WhatsApp;
  los formularios instantáneos de Meta (Lead Ads) no están integrados aún.
- Los nombres de algunas métricas de la Graph API cambian entre versiones; si
  una no está disponible, la sincronización sigue sin ella.
