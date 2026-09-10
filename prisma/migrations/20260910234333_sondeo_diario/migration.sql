-- CreateEnum
CREATE TYPE "FuenteCotizacion" AS ENUM ('ALIBABA', 'MANUAL', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoRevision" AS ENUM ('EN_PROGRESO', 'COMPLETADA', 'PARCIAL', 'FALLIDA');

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "minCotizaciones" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "seguimientoActivo" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "RevisionDiaria" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoRevision" NOT NULL DEFAULT 'EN_PROGRESO',
    "minPorProducto" INTEGER NOT NULL DEFAULT 5,
    "productosObjetivo" INTEGER NOT NULL DEFAULT 0,
    "productosRevisados" INTEGER NOT NULL DEFAULT 0,
    "cotizacionesNuevas" INTEGER NOT NULL DEFAULT 0,
    "resumen" TEXT,
    "detalle" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevisionDiaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotizacionMercado" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "proyectoId" TEXT,
    "revisionId" TEXT,
    "fuente" "FuenteCotizacion" NOT NULL DEFAULT 'ALIBABA',
    "proveedorNombre" TEXT NOT NULL,
    "proveedorPais" TEXT,
    "proveedorUrl" TEXT,
    "precioUnit" DOUBLE PRECISION,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "moq" DOUBLE PRECISION,
    "incoterm" TEXT,
    "tiempoEntregaDias" INTEGER,
    "notas" TEXT,
    "fechaRevision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CotizacionMercado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CotizacionMercado_productoId_fechaRevision_idx" ON "CotizacionMercado"("productoId", "fechaRevision");

-- CreateIndex
CREATE INDEX "CotizacionMercado_revisionId_idx" ON "CotizacionMercado"("revisionId");

-- AddForeignKey
ALTER TABLE "CotizacionMercado" ADD CONSTRAINT "CotizacionMercado_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionMercado" ADD CONSTRAINT "CotizacionMercado_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionMercado" ADD CONSTRAINT "CotizacionMercado_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "RevisionDiaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionMercado" ADD CONSTRAINT "CotizacionMercado_capturadoPorId_fkey" FOREIGN KEY ("capturadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
