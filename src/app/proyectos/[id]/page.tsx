import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/nav-bar";
import { CotizacionesPanel } from "@/components/cotizaciones-panel";
import { ComparadorCotizaciones } from "@/components/comparador-cotizaciones";
import { getServerLocale } from "@/lib/get-server-locale";
import { getDictionary } from "@/lib/i18n";

export default async function ProyectoPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const t = getDictionary(getServerLocale());

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: params.id },
    include: {
      items: { include: { producto: true } },
      cotizaciones: {
        include: {
          proveedor: true,
          items: { include: { producto: true } },
          archivos: { include: { subidoPor: { select: { nombre: true } } } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!proyecto) notFound();

  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">{proyecto.nombre}</h1>
          <span className="text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded-full">
            {proyecto.estado}
          </span>
        </div>
        {proyecto.descripcion && (
          <p className="text-gray-600 mb-8">{proyecto.descripcion}</p>
        )}

        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">{t.proyecto.bom}</h2>
          {proyecto.items.length === 0 ? (
            <p className="text-gray-500 text-sm">{t.proyecto.sinItems}</p>
          ) : (
            <table className="w-full bg-white border rounded-xl overflow-hidden text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="px-4 py-2">{t.proyecto.producto}</th>
                  <th className="px-4 py-2">{t.proyecto.cantidad}</th>
                  <th className="px-4 py-2">{t.proyecto.unidad}</th>
                  <th className="px-4 py-2">{t.proyecto.notas}</th>
                </tr>
              </thead>
              <tbody>
                {proyecto.items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-2">
                      {item.producto?.nombre ?? item.nombreLibre ?? "—"}
                    </td>
                    <td className="px-4 py-2">{item.cantidad}</td>
                    <td className="px-4 py-2">{item.unidad}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {item.notas ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {proyecto.cotizaciones.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-3">{t.proyecto.comparador}</h2>
            <ComparadorCotizaciones cotizaciones={proyecto.cotizaciones} t={t} />
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">{t.proyecto.cotizaciones}</h2>
            {proyecto.cotizaciones.some((c) => c.estado === "APROBADA") && (
              <div className="flex gap-2">
                <a
                  href={`/api/proyectos/${proyecto.id}/exportar?formato=excel`}
                  className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50"
                >
                  {t.proyecto.exportarExcel}
                </a>
                <a
                  href={`/api/proyectos/${proyecto.id}/exportar?formato=pdf`}
                  className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50"
                >
                  {t.proyecto.exportarPdf}
                </a>
              </div>
            )}
          </div>
          <CotizacionesPanel
            proyectoId={proyecto.id}
            cotizaciones={proyecto.cotizaciones}
          />
        </section>
      </div>
    </main>
  );
}
