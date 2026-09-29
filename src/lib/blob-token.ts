/**
 * Token de lectura/escritura de Vercel Blob.
 *
 * Al conectar un Blob store, Vercel crea `BLOB_READ_WRITE_TOKEN`; pero si ya
 * existía una variable con ese nombre, la crea con prefijo (p. ej.
 * `OASIS_IMAGENES_READ_WRITE_TOKEN`). Se acepta cualquiera de las dos, siempre
 * que el valor tenga el formato de un token de Blob.
 */
export function tokenBlob(): string | null {
  const directo = process.env.BLOB_READ_WRITE_TOKEN;
  if (directo?.startsWith("vercel_blob_rw_")) return directo;
  for (const [nombre, valor] of Object.entries(process.env)) {
    if (nombre.endsWith("READ_WRITE_TOKEN") && valor?.startsWith("vercel_blob_rw_")) return valor;
  }
  return null;
}

/** Nombres de variables tipo Blob presentes (sin valores), para diagnosticar. */
export function variablesBlobPresentes(): string[] {
  return Object.keys(process.env).filter((n) => n.includes("BLOB") || n.endsWith("READ_WRITE_TOKEN"));
}
