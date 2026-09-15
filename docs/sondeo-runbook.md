# Runbook — Sondeo diario de cotizaciones

Procedimiento que ejecuta la **revisión diaria**: por cada producto en
seguimiento, conseguir al menos `minCotizaciones` (por defecto **5**) cotizaciones
de mercado desde Alibaba y registrarlas en la app.

Sirve para dos cosas:

1. **Manual, hoy** — se ejecuta en una sesión de Claude Code contra la app local
   (`http://localhost:3000`) o desplegada.
2. **Automático, Fase 2** — el mismo texto de la sección "Procedimiento" se usa
   como *prompt* de la tarea programada (routine) que corre en la nube de Claude.
   Requiere la app desplegada con URL pública. Ver `sondeo-fase2-despliegue.md`.

---

## Requisitos

- `APP_URL` — URL base de la app (ej. `https://tu-app.vercel.app` o `http://localhost:3000`).
- `CRON_SECRET` — token del `.env`. Se envía como `Authorization: Bearer <CRON_SECRET>`
  en todas las llamadas. Solo da acceso a `/api/sondeo/*`.

Prueba rápida de conectividad:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/sondeo/worklist?dias=1"
```

---

## Procedimiento

> Este es el texto que sigue Claude (manual o programado). Está redactado en
> segunda persona para poder pegarlo tal cual como prompt de la routine.

1. **Obtén la lista de trabajo.**
   `GET {APP_URL}/api/sondeo/worklist?dias=1`
   Devuelve `items[]`, cada uno con `productoId`, `nombre`, `terminosBusqueda`,
   `urlBusquedaAlibaba`, `minCotizaciones`, `cotizacionesEnVentana` y `faltantes`.
   Si `items` está vacío, no hay nada pendiente hoy: termina sin crear revisión.

2. **Abre una revisión.**
   `POST {APP_URL}/api/sondeo/revisiones`
   body: `{ "minPorProducto": 5, "productosObjetivo": <items.length> }`
   Guarda el `id` que devuelve (`revisionId`).

3. **Para cada producto con `faltantes > 0`:**
   1. Abre `urlBusquedaAlibaba` en el navegador (o `https://www.alibaba.com/trade/search?SearchText=<terminosBusqueda>`).
   2. Recolecta al menos `faltantes` ofertas (apunta a cubrir `minCotizaciones`
      en total contando lo que ya había). De cada oferta toma:
      - `proveedorNombre` (obligatorio) — nombre de la tienda / fabricante
      - `proveedorPais` — país del proveedor
      - `proveedorUrl` — enlace a la ficha del producto/proveedor
      - `precioUnit` y `moneda` — si hay rango, usa el precio más bajo del rango
        y anota el rango completo en `notas`
      - `moq` — cantidad mínima de pedido
      - `incoterm` — **revisa la ficha completa del producto**, no solo el precio
        (a veces está en una tabla de "Trade Terms" / "Shipping" / "Port"). Casi
        todas las fábricas chinas en Alibaba cotizan **FOB** por defecto — si la
        página no lo dice explícitamente pero es una ficha típica de exportación
        de fábrica, escribe `"FOB (no especificado explícitamente)"` en vez de
        dejarlo vacío. Solo déjalo vacío si de verdad no hay ninguna pista.
        **No inventes CIF ni un puerto de destino** — eso lo calcula la app
        aparte con la tarifa de flete que el usuario cargó manualmente
        (`Producto.fleteEstimadoUnit`); tu trabajo es solo reportar el incoterm
        real de la oferta (normalmente FOB/EXW en fábrica).
      - `tiempoEntregaDias` — lead time si aparece
      - `notas` — rango de precio, potencia/especificación, "Verified Supplier", años, etc.
   3. Prioriza proveedores con "Verified Supplier" / "Trade Assurance" y varios
      años de antigüedad. Descarta resultados que claramente no correspondan al
      producto (otra potencia, accesorios, etc.).
   4. **Si Alibaba muestra un captcha o un muro de verificación: NO lo resuelvas.**
      Registra lo que hayas alcanzado a recolectar para ese producto y anótalo
      como pendiente para el resumen.

4. **Carga las cotizaciones.**
   `POST {APP_URL}/api/sondeo/cotizaciones`
   body:
   ```json
   {
     "revisionId": "<revisionId>",
     "fuente": "ALIBABA",
     "items": [
       {
         "productoId": "...",
         "proveedorNombre": "Hefei JA Solar Co., Ltd.",
         "proveedorPais": "China",
         "proveedorUrl": "https://www.alibaba.com/product-detail/...",
         "precioUnit": 88.5,
         "moneda": "USD",
         "unidad": "unidad",
         "moq": 100,
         "incoterm": "FOB",
         "tiempoEntregaDias": 30,
         "notas": "Rango 88.5–95 USD. Verified Supplier, 7 años."
       }
     ]
   }
   ```
   Puedes enviar todos los productos en una sola llamada (máx. 200 ítems) o una
   llamada por producto.

5. **Cierra la revisión.**
   `PATCH {APP_URL}/api/sondeo/revisiones/{revisionId}`
   body:
   ```json
   {
     "estado": "COMPLETADA",
     "productosRevisados": <cuántos productos quedaron con faltantes = 0>,
     "resumen": "Markdown: qué se revisó, precios min/prom por producto, y qué quedó pendiente y por qué."
   }
   ```
   - `"COMPLETADA"` si todos los productos llegaron a su mínimo.
   - `"PARCIAL"` si faltó alguno (captcha, sin resultados relevantes, etc.);
     lista en el `resumen` cuáles y por qué.
   - `"FALLIDA"` si no se pudo registrar nada.

6. **Verifica.**
   `GET {APP_URL}/api/sondeo/worklist?dias=1` de nuevo y confirma que
   `productosPendientes` bajó como esperabas.

---

## Notas

- **Duplicados:** la carga no deduplica. Si repites la revisión el mismo día,
  vuelve a crear filas. Corre la revisión una vez al día.
- **Corrección manual:** cualquier fila se edita o borra desde
  `/sondeo/producto/{id}` en la app, o vía
  `PATCH` / `DELETE {APP_URL}/api/sondeo/cotizaciones/{id}`.
- **Alcance del token:** `CRON_SECRET` no puede leer usuarios, proyectos ni
  cotizaciones formales (RFQ). Solo `/api/sondeo/*`.
- **Ventana:** `dias=1` = "¿qué falta hoy?". Para reponer un backlog usa
  `dias=7` y súbelo poco a poco.
