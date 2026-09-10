import { getServerSession } from "next-auth";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";

export type SondeoActor =
  | { tipo: "cron" }
  | { tipo: "usuario"; id: string; empresaId: string | null; rol: string };

function comparaSecreto(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Autoriza una petición a /api/sondeo/*.
 *
 * Acepta dos formas de identidad:
 *  - Sesión de navegador válida (NextAuth) -> actor "usuario".
 *  - Header `Authorization: Bearer <CRON_SECRET>` -> actor "cron",
 *    que usa la tarea programada de Claude. Este token SOLO sirve para
 *    /api/sondeo/*; no da acceso al resto de la aplicación.
 *
 * Devuelve el actor o `null` si no está autorizado.
 */
export async function autorizarSondeo(req: Request): Promise<SondeoActor | null> {
  const header = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (secret && header.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    if (comparaSecreto(token, secret)) return { tipo: "cron" };
  }

  const session = await getServerSession(authOptions);
  if (session?.user) {
    const u = session.user as any;
    return {
      tipo: "usuario",
      id: u.id,
      empresaId: u.empresaId ?? null,
      rol: u.rol,
    };
  }

  return null;
}
