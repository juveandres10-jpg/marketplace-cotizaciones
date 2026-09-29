/**
 * Credenciales de Vercel Blob.
 *
 * Hay dos formas según cómo se creó el Blob store:
 *  - Stores clásicos: token `vercel_blob_rw_…` en `BLOB_READ_WRITE_TOKEN`
 *    (o con prefijo, p. ej. `OASIS_IMAGENES_READ_WRITE_TOKEN`, si ya existía
 *    una variable con ese nombre al conectarlo).
 *  - Stores nuevos: `BLOB_STORE_ID` + el token OIDC que Vercel inyecta en cada
 *    función; el SDK (@vercel/blob >= 2) lo resuelve solo.
 */
export function tokenBlob(): string | null {
  const directo = process.env.BLOB_READ_WRITE_TOKEN;
  if (directo?.startsWith("vercel_blob_rw_")) return directo;
  for (const [nombre, valor] of Object.entries(process.env)) {
    if (nombre.endsWith("READ_WRITE_TOKEN") && valor?.startsWith("vercel_blob_rw_")) return valor;
  }
  return null;
}

export function blobConfigurado(): boolean {
  return Boolean(tokenBlob() || process.env.BLOB_STORE_ID);
}

/** Opciones de credencial para put/del: token clásico si existe; si no, OIDC automático. */
export function credencialesBlob(): { token?: string } {
  const token = tokenBlob();
  return token ? { token } : {};
}

/** Nombres de variables tipo Blob presentes (sin valores), para diagnosticar. */
export function variablesBlobPresentes(): string[] {
  return Object.keys(process.env).filter((n) => n.includes("BLOB") || n.endsWith("READ_WRITE_TOKEN"));
}
