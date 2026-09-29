import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/nav-bar";
import { AnalisisVista, ESTADO_PLAN_BADGE, ESTADO_PLAN_LABEL, dinero } from "@/components/mercadeo-plan-vista";
import { GenerarPlanBoton, SincronizarMetaBoton } from "@/components/mercadeo-acciones";
import { analisisDeEmpresa } from "@/lib/mercadeo/servicio";
import { estadoConfiguracionMeta } from "@/lib/mercadeo/meta";
import { formatoFecha } from "@/lib/mercadeo/fechas";

export const dynamic = "force-dynamic";

export default async function MercadeoPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const empresaId = (session.user as any).empresaId as string | null;
  if (!empresaId) redirect("/dashboard");

  const [proyectos, planes, analisis] = await Promise.all([
    prisma.proyectoVenta.findMany({
      where: { empresaId },
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    }),
    prisma.planSemanal.findMany({
      where: { empresaId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { proyectoVenta: { select: { nombre: true } }, _count: { select: { piezas: true } } },
    }),
    analisisDeEmpresa(empresaId, 0),
  ]);
  const meta = estadoConfiguracionMeta();
  const conexiones = [
    { nombre: "Facebook (Página)", ok: meta.pagina },
    { nombre: "Instagram", ok: meta.instagram },
    { nombre: "Cuenta publicitaria", ok: meta.anuncios },
    { nombre: "Claude (redacción IA)", ok: Boolean(process.env.ANTHROPIC_API_KEY) },
    { nombre: "Correo (Resend)", ok: Boolean(process.env.RESEND_API_KEY) },
  ];

  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Mercadeo automatizado</h1>
            <p className="text-sm text-gray-500 mt-1">
              Análisis de Facebook e Instagram → plan semanal de publicaciones y pauta → aprobación por correo → publicación en Meta.
            </p>
          </div>
          <div className="flex gap-2 items-start">
            <Link href="/mercadeo/marca" className="border px-4 py-2 rounded-lg font-medium hover:bg-gray-50 text-sm">
              Kit de marca
            </Link>
            <Link href="/mercadeo/metricas" className="border px-4 py-2 rounded-lg font-medium hover:bg-gray-50 text-sm">
              Cargar métricas
            </Link>
            <SincronizarMetaBoton habilitado={meta.token} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8 text-xs">
          {conexiones.map((c) => (
            <span
              key={c.nombre}
              className={`px-2 py-1 rounded-full ${c.ok ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
            >
              {c.ok ? "●" : "○"} {c.nombre}
            </span>
          ))}
        </div>

        <h2 className="font-semibold text-lg mb-3">Cómo están las redes hoy</h2>
        <div className="mb-10">
          <AnalisisVista analisis={analisis} />
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Proyectos en venta</h2>
          <Link
            href="/mercadeo/proyectos/nuevo"
            className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 text-sm"
          >
            + Nuevo proyecto
          </Link>
        </div>
        <div className="grid gap-3 mb-10">
          {proyectos.map((p) => (
            <div key={p.id} className={`border rounded-xl bg-white p-4 ${p.activo ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <Link href={`/mercadeo/proyectos/${p.id}`} className="font-medium text-brand-700 hover:underline">
                    {p.nombre}
                  </Link>
                  <div className="text-xs text-gray-500">
                    {[p.tipoInmueble, p.zona, p.ciudad].filter(Boolean).join(" · ")}
                    {p.precioDesde != null && ` · desde ${dinero(p.precioDesde, p.moneda)}`}
                    {!p.activo && " · inactivo"}
                  </div>
                  <Link href={`/mercadeo/proyectos/${p.id}`} className="text-xs text-brand-700 hover:underline">
                    {p.imagenes.length ? `${p.imagenes.length} fotos/renders` : "+ Subir fotos y renders"}
                  </Link>
                  {!p.whatsapp && !p.urlLanding && (
                    <div className="text-xs text-amber-700 mt-1">
                      Sin WhatsApp ni landing: la pauta no tendrá a dónde llevar a los interesados.
                    </div>
                  )}
                </div>
                <GenerarPlanBoton proyectoVentaId={p.id} presupuestoSugerido={p.presupuestoSemanal} moneda={p.moneda} />
              </div>
            </div>
          ))}
          {proyectos.length === 0 && (
            <p className="text-sm text-gray-400">
              Crea el primer proyecto con su información comercial (precio desde, ubicación, amenidades, WhatsApp): es la base de
              los copies y las piezas.
            </p>
          )}
        </div>

        <h2 className="font-semibold text-lg mb-3">Planes semanales</h2>
        <div className="overflow-x-auto border rounded-xl bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Semana</th>
                <th className="px-4 py-2 font-medium">Proyecto</th>
                <th className="px-4 py-2 font-medium text-center">Piezas</th>
                <th className="px-4 py-2 font-medium text-right">Pauta</th>
                <th className="px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {planes.map((pl) => (
                <tr key={pl.id}>
                  <td className="px-4 py-2">
                    <Link href={`/mercadeo/planes/${pl.id}`} className="text-brand-700 hover:underline font-medium">
                      {formatoFecha(pl.semanaInicio)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{pl.proyectoVenta.nombre}</td>
                  <td className="px-4 py-2 text-center">{pl._count.piezas}</td>
                  <td className="px-4 py-2 text-right">{dinero(pl.presupuestoTotal, pl.moneda)}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_PLAN_BADGE[pl.estado]}`}>
                      {ESTADO_PLAN_LABEL[pl.estado]}
                    </span>
                  </td>
                </tr>
              ))}
              {planes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    Aún no hay planes. Genera uno desde un proyecto.
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
