import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

// GET /api/proyectos/[id]/exportar?formato=excel|pdf
// Exporta únicamente las cotizaciones en estado APROBADA del proyecto.
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const formato = searchParams.get("formato") ?? "excel";

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: params.id },
    include: {
      cotizaciones: {
        where: { estado: "APROBADA" },
        include: { proveedor: true, items: { include: { producto: true } } },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!proyecto) {
    return new Response(JSON.stringify({ error: "Proyecto no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (proyecto.cotizaciones.length === 0) {
    return new Response(
      JSON.stringify({ error: "Este proyecto no tiene cotizaciones aprobadas" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const filas = proyecto.cotizaciones.flatMap((cot) =>
    cot.items.map((item) => ({
      proveedor: cot.proveedor.nombre,
      item: item.producto?.nombre ?? item.descripcion,
      cantidad: item.cantidad,
      precioUnit: item.precioUnit,
      subtotal: item.subtotal,
      moneda: cot.moneda,
      validaHasta: cot.validaHasta,
    }))
  );

  const totalGeneral = filas.reduce((acc, f) => acc + (f.subtotal ?? 0), 0);

  if (formato === "pdf") {
    return generarPdf(proyecto.nombre, filas, totalGeneral);
  }
  return generarExcel(proyecto.nombre, filas, totalGeneral);
}

async function generarExcel(
  nombreProyecto: string,
  filas: Array<{
    proveedor: string;
    item: string;
    cantidad: number;
    precioUnit: number | null;
    subtotal: number | null;
    moneda: string;
    validaHasta: Date | null;
  }>,
  totalGeneral: number
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Marketplace de Cotizaciones";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Cotizaciones aprobadas");

  sheet.columns = [
    { header: "Proveedor", key: "proveedor", width: 28 },
    { header: "Ítem", key: "item", width: 36 },
    { header: "Cantidad", key: "cantidad", width: 12 },
    { header: "Moneda", key: "moneda", width: 10 },
    { header: "Precio unit.", key: "precioUnit", width: 14 },
    { header: "Subtotal", key: "subtotal", width: 16 },
    { header: "Válida hasta", key: "validaHasta", width: 14 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE5EDFF" },
  };

  for (const fila of filas) {
    sheet.addRow({
      proveedor: fila.proveedor,
      item: fila.item,
      cantidad: fila.cantidad,
      moneda: fila.moneda,
      precioUnit: fila.precioUnit,
      subtotal: fila.subtotal,
      validaHasta: fila.validaHasta
        ? fila.validaHasta.toISOString().slice(0, 10)
        : "",
    });
  }

  sheet.addRow({});
  const filaTotal = sheet.addRow({ item: "TOTAL", subtotal: totalGeneral });
  filaTotal.font = { bold: true };

  sheet.getColumn("precioUnit").numFmt = "#,##0.00";
  sheet.getColumn("subtotal").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();

  const filename = `cotizaciones-aprobadas-${slugify(nombreProyecto)}.xlsx`;

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function generarPdf(
  nombreProyecto: string,
  filas: Array<{
    proveedor: string;
    item: string;
    cantidad: number;
    precioUnit: number | null;
    subtotal: number | null;
    moneda: string;
    validaHasta: Date | null;
  }>,
  totalGeneral: number
): Promise<Response> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const filename = `cotizaciones-aprobadas-${slugify(nombreProyecto)}.pdf`;
      resolve(
        new Response(buffer, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        })
      );
    });

    doc.fontSize(18).text(`Cotizaciones aprobadas — ${nombreProyecto}`, {
      align: "left",
    });
    doc.moveDown();
    doc.fontSize(9).fillColor("#666").text(
      `Generado el ${new Date().toLocaleDateString("es-CO")}`
    );
    doc.moveDown(1.5);

    const colX = { proveedor: 40, item: 160, cant: 320, precio: 380, subtotal: 460 };

    doc.fontSize(10).fillColor("#000").font("Helvetica-Bold");
    doc.text("Proveedor", colX.proveedor, doc.y, { continued: false });
    doc.text("Ítem", colX.item, doc.y - 12);
    doc.text("Cant.", colX.cant, doc.y - 12);
    doc.text("P. Unit.", colX.precio, doc.y - 12);
    doc.text("Subtotal", colX.subtotal, doc.y - 12);
    doc.moveDown(0.5);
    doc
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .strokeColor("#ccc")
      .stroke();
    doc.moveDown(0.3);

    doc.font("Helvetica").fontSize(9);
    for (const fila of filas) {
      const y = doc.y;
      doc.text(fila.proveedor, colX.proveedor, y, { width: 115 });
      doc.text(fila.item, colX.item, y, { width: 155 });
      doc.text(String(fila.cantidad), colX.cant, y, { width: 55 });
      doc.text(
        fila.precioUnit != null ? `${fila.moneda} ${fila.precioUnit.toFixed(2)}` : "—",
        colX.precio,
        y,
        { width: 75 }
      );
      doc.text(
        fila.subtotal != null ? `${fila.moneda} ${fila.subtotal.toLocaleString()}` : "—",
        colX.subtotal,
        y,
        { width: 95 }
      );
      doc.moveDown(0.8);

      if (doc.y > 760) {
        doc.addPage();
      }
    }

    doc.moveDown(1);
    doc
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .strokeColor("#ccc")
      .stroke();
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(11);
    doc.text(`Total: ${totalGeneral.toLocaleString()}`, colX.subtotal - 60, doc.y);

    doc.end();
  });
}

function slugify(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
