import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/nav-bar";
import { CargaMetricas } from "@/components/mercadeo-carga-metricas";
import { dinero } from "@/components/mercadeo-plan-vista";
import { formatoFechaHora } from "@/lib/mercadeo/fechas";

export const dynamic = "force-dynamic";

export default async function MetricasPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const empresaId = (session.user as any).empresaId ?? "";
  const recientes = await prisma.metricaPublicacion.findMany({
    where: { empresaId },
    orderBy: { fechaPublicacion: "desc" },
    take: 40,
  });

  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link href="/mercadeo" className="text-sm text-gray-500 hover:underline">
          ← Mercadeo
        </Link>
        <h1 className="text-2xl font-bold mt-2 mb-2">Cargar métricas</h1>
        <p className="text-sm text-gray-500 mb-6">
          Si Meta está conectado usa &quot;Sincronizar con Meta&quot;. Si no, pega aquí las métricas exportadas.
        </p>
        <CargaMetricas />

        <h2 className="font-semibold text-lg mt-10 mb-3">Últimas publicaciones registradas</h2>
        <div className="overflow-x-auto border rounded-xl bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Red</th>
                <th className="px-3 py-2 font-medium">Formato</th>
                <th className="px-3 py-2 font-medium text-right">Alcance</th>
                <th className="px-3 py-2 font-medium text-right">Interacc.</th>
                <th className="px-3 py-2 font-medium text-right">Clics</th>
                <th className="px-3 py-2 font-medium text-right">Leads/Msj</th>
                <th className="px-3 py-2 font-medium text-right">Gasto</th>
                <th className="px-3 py-2 font-medium">Fuente</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recientes.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2 whitespace-nowrap">{formatoFechaHora(m.fechaPublicacion)}</td>
                  <td className="px-3 py-2">{m.plataforma === "INSTAGRAM" ? "IG" : "FB"}</td>
                  <td className="px-3 py-2">
                    {m.formato.toLowerCase()}
                    {m.pagada && <span className="text-amber-700"> · pauta</span>}
                  </td>
                  <td className="px-3 py-2 text-right">{m.alcance.toLocaleString("es-CO")}</td>
                  <td className="px-3 py-2 text-right">{m.interacciones.toLocaleString("es-CO")}</td>
                  <td className="px-3 py-2 text-right">{m.clics.toLocaleString("es-CO")}</td>
                  <td className="px-3 py-2 text-right">
                    {m.leads}/{m.mensajes}
                  </td>
                  <td className="px-3 py-2 text-right">{m.gasto > 0 ? dinero(m.gasto, m.moneda) : "—"}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{m.fuente === "META_API" ? "Meta" : "Manual"}</td>
                </tr>
              ))}
              {recientes.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-gray-400">
                    Sin métricas todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
