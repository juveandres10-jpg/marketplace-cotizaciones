import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

// GET /api/sondeo/exportar?productoId=...&dias=...
//
// Exporta el sondeo de cotizaciones de mercado a Excel, con dos hojas:
//  1) "Cotizaciones": el detalle de cada cotización (producto, proveedor,
//     precio, MOQ, incoterm, etc.) en forma de cuadro.
//  2) "Documentos soporte": el enlace de origen de cada cotización (la
//     página/ficha de Alibaba u otra fuente donde se encontró el precio),
//     que sirve como respaldo/evidencia — el sondeo no tiene archivos
//     adjuntos como el flujo de RFQ formal, así que el "soporte" es el link.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const productoId = searchParams.get("productoId") ?? undefined;
  const dias = searchParams.get("dias") ? Number(searchParams.get("dias")) : null;

  const cotizaciones = await prisma.cotizacionMercado.findMany({
    where: {
      productoId,
      ...(dias
        ? { fechaRevision: { gte: new Date(Date.now() - dias * 86_400_000) } }
        : {}),
    },
    include: {
      producto: {
        select: {
          nombre: true,
          marca: true,
          modelo: true,
          moneda: true,
          categoria: { select: { nombre: true } },
          fleteEstimadoUnit: true,
          fleteEstimadoDestino: true,
        },
      },
      proyecto: { select: { nombre: true } },
      capturadoPor: { select: { nombre: true } },
    },
    orderBy: [{ productoId: "asc" }, { fechaRevision: "desc" }],
  });

  if (cotizaciones.length === 0) {
    return new Response(
      JSON.stringify({ error: "No hay cotizaciones de mercado para exportar" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Marketplace de Cotizaciones — Sondeo diario";
  workbook.created = new Date();

  // ---- Hoja 1: Cotizaciones ----
  const hojaCot = workbook.addWorksheet("Cotizaciones");
  hojaCot.columns = [
    { header: "Producto", key: "producto", width: 32 },
    { header: "Marca / Modelo", key: "marcaModelo", width: 22 },
    { header: "Categoría", key: "categoria", width: 18 },
    { header: "Proyecto", key: "proyecto", width: 20 },
    { header: "Proveedor", key: "proveedor", width: 32 },
    { header: "País", key: "pais", width: 14 },
    { header: "Precio unit.", key: "precioUnit", width: 14 },
    { header: "Moneda", key: "moneda", width: 10 },
    { header: "Unidad", key: "unidad", width: 10 },
    { header: "MOQ", key: "moq", width: 10 },
    { header: "Incoterm", key: "incoterm", width: 26 },
    { header: "Entrega (días)", key: "entrega", width: 14 },
    { header: "Fuente", key: "fuente", width: 12 },
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Capturado por", key: "capturadoPor", width: 18 },
    { header: "CIF estimado", key: "cifEstimado", width: 16 },
    { header: "Destino CIF", key: "cifDestino", width: 26 },
    { header: "Notas", key: "notas", width: 40 },
  ];
  hojaCot.getRow(1).font = { bold: true };
  hojaCot.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE5EDFF" },
  };

  for (const c of cotizaciones) {
    // El CIF solo se calcula si la cotización está en la misma moneda del
    // producto — mezclar monedas sin una tasa de cambio real sería inventar
    // el número. La tarifa de flete la ingresa el usuario, nunca el sondeo.
    const aplicaCif =
      c.producto.fleteEstimadoUnit != null &&
      c.moneda === c.producto.moneda &&
      c.precioUnit != null;
    hojaCot.addRow({
      producto: c.producto.nombre,
      marcaModelo: [c.producto.marca, c.producto.modelo].filter(Boolean).join(" "),
      categoria: c.producto.categoria?.nombre ?? "",
      proyecto: c.proyecto?.nombre ?? "",
      proveedor: c.proveedorNombre,
      pais: c.proveedorPais ?? "",
      precioUnit: c.precioUnit,
      moneda: c.moneda,
      unidad: c.unidad,
      moq: c.moq,
      incoterm: c.incoterm ?? "",
      entrega: c.tiempoEntregaDias,
      fuente: c.fuente,
      fecha: c.fechaRevision.toISOString().slice(0, 10),
      capturadoPor: c.capturadoPor?.nombre ?? "Sondeo automático",
      cifEstimado: aplicaCif
        ? Number((c.precioUnit! + c.producto.fleteEstimadoUnit!).toFixed(2))
        : "",
      cifDestino: aplicaCif ? c.producto.fleteEstimadoDestino ?? "CIF (destino no especificado)" : "",
      notas: c.notas ?? "",
    });
  }
  hojaCot.getColumn("precioUnit").numFmt = "#,##0.00";
  hojaCot.getColumn("cifEstimado").numFmt = "#,##0.00";
  hojaCot.autoFilter = { from: "A1", to: "R1" };
  hojaCot.views = [{ state: "frozen", ySplit: 1 }];

  // ---- Hoja 2: Documentos soporte (enlaces de origen) ----
  const hojaSoporte = workbook.addWorksheet("Documentos soporte");
  hojaSoporte.columns = [
    { header: "Producto", key: "producto", width: 32 },
    { header: "Proveedor", key: "proveedor", width: 32 },
    { header: "Fuente", key: "fuente", width: 12 },
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Enlace de respaldo", key: "url", width: 60 },
  ];
  hojaSoporte.getRow(1).font = { bold: true };
  hojaSoporte.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE5EDFF" },
  };

  const conEnlace = cotizaciones.filter((c) => c.proveedorUrl);
  for (const c of conEnlace) {
    const fila = hojaSoporte.addRow({
      producto: c.producto.nombre,
      proveedor: c.proveedorNombre,
      fuente: c.fuente,
      fecha: c.fechaRevision.toISOString().slice(0, 10),
      url: c.proveedorUrl,
    });
    const celdaUrl = fila.getCell("url");
    celdaUrl.value = { text: c.proveedorUrl as string, hyperlink: c.proveedorUrl as string };
    celdaUrl.font = { color: { argb: "FF2563EB" }, underline: true };
  }
  hojaSoporte.views = [{ state: "frozen", ySplit: 1 }];

  if (conEnlace.length === 0) {
    hojaSoporte.addRow({ producto: "(ninguna cotización trae enlace de origen)" });
  } else if (conEnlace.length < cotizaciones.length) {
    hojaSoporte.addRow({});
    hojaSoporte.addRow({
      producto: `Nota: ${cotizaciones.length - conEnlace.length} cotización(es) no tienen enlace de origen registrado.`,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `sondeo-cotizaciones-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
