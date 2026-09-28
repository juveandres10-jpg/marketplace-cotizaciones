import { getServerSession } from "next-auth";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";

export type MercadeoActor =
  | { tipo: "cron"; empresaId: string }
  | { tipo: "usuario"; id: string; empresaId: string; rolEmpresa: string };

function comparaSecreto(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Autoriza una petición a /api/mercadeo/*.
 *  - Sesión de navegador de un usuario con empresa -> actor "usuario".
 *  - `Authorization: Bearer <MERCADEO_CRON_SECRET>` -> actor "cron" que
 *    opera sobre MERCADEO_EMPRESA_ID (tarea automática semanal). Es un
 *    secreto distinto a CRON_SECRET (sondeo) y solo sirve para mercadeo.
 */
export async function autorizarMercadeo(req: Request): Promise<MercadeoActor | null> {
  const header = req.headers.get("authorization") ?? "";
  const secret = process.env.MERCADEO_CRON_SECRET;
  const empresaCron = process.env.MERCADEO_EMPRESA_ID;
  if (secret && empresaCron && header.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    if (comparaSecreto(token, secret)) return { tipo: "cron", empresaId: empresaCron };
  }

  const session = await getServerSession(authOptions);
  const u = session?.user as any;
  if (u?.empresaId) {
    return { tipo: "usuario", id: u.id, empresaId: u.empresaId, rolEmpresa: u.rolEmpresa };
  }
  return null;
}
