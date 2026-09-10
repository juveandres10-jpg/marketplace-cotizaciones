import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/nav-bar";
import { BuscadorProductos } from "@/components/buscador-productos";
import { getServerLocale } from "@/lib/get-server-locale";
import { getDictionary } from "@/lib/i18n";

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const t = getDictionary(getServerLocale());

  const productos = await prisma.producto.findMany({
    where: searchParams.q
      ? {
          OR: [
            { nombre: { contains: searchParams.q, mode: "insensitive" } },
            { marca: { contains: searchParams.q, mode: "insensitive" } },
          ],
        }
      : {},
    include: { proveedor: true, categoria: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">{t.productos.titulo}</h1>
        <BuscadorProductos initialQuery={searchParams.q ?? ""} />

        <div className="grid gap-3 mt-6">
          {productos.map((p) => (
            <div key={p.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {p.nombre} {p.marca ? `— ${p.marca}` : ""}
                </h3>
                {p.precioRef != null && (
                  <span className="text-sm font-medium text-brand-700">
                    {p.moneda} {p.precioRef.toLocaleString()} / {p.unidad}
                  </span>
                )}
              </div>
              {p.descripcion && (
                <p className="text-sm text-gray-600 mt-1">{p.descripcion}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {t.productos.proveedor}: {p.proveedor.nombre}
              </p>
            </div>
          ))}
          {productos.length === 0 && (
            <p className="text-gray-500 text-sm">{t.productos.sinResultados}</p>
          )}
        </div>
      </div>
    </main>
  );
}
