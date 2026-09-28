-- CreateEnum
CREATE TYPE "PlataformaSocial" AS ENUM ('FACEBOOK', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "FormatoPieza" AS ENUM ('IMAGEN', 'CARRUSEL', 'VIDEO', 'REEL', 'HISTORIA');

-- CreateEnum
CREATE TYPE "ObjetivoPauta" AS ENUM ('LEADS', 'MENSAJES', 'TRAFICO', 'ALCANCE');

-- CreateEnum
CREATE TYPE "FuenteMetrica" AS ENUM ('META_API', 'MANUAL');

-- CreateEnum
CREATE TYPE "EstadoPlan" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'RECHAZADO', 'PUBLICADO');

-- CreateTable
CREATE TABLE "ProyectoVenta" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoInmueble" TEXT NOT NULL DEFAULT 'Apartamentos',
    "ciudad" TEXT NOT NULL,
    "zona" TEXT,
    "direccion" TEXT,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "precioDesde" DOUBLE PRECISION,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "areaDesde" DOUBLE PRECISION,
    "habitaciones" TEXT,
    "amenidades" TEXT,
    "diferenciales" TEXT,
    "publicoObjetivo" TEXT,
    "urlLanding" TEXT,
    "whatsapp" TEXT,
    "imagenUrl" TEXT,
    "presupuestoSemanal" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProyectoVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricaPublicacion" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "proyectoVentaId" TEXT,
    "plataforma" "PlataformaSocial" NOT NULL,
    "fuente" "FuenteMetrica" NOT NULL DEFAULT 'MANUAL',
    "externoId" TEXT,
    "fechaPublicacion" TIMESTAMP(3) NOT NULL,
    "horaConocida" BOOLEAN NOT NULL DEFAULT true,
    "formato" "FormatoPieza" NOT NULL DEFAULT 'IMAGEN',
    "pagada" BOOLEAN NOT NULL DEFAULT false,
    "texto" TEXT,
    "alcance" INTEGER NOT NULL DEFAULT 0,
    "impresiones" INTEGER NOT NULL DEFAULT 0,
    "interacciones" INTEGER NOT NULL DEFAULT 0,
    "clics" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "mensajes" INTEGER NOT NULL DEFAULT 0,
    "gasto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricaPublicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotCuenta" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "plataforma" "PlataformaSocial" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seguidores" INTEGER NOT NULL,
    "fuente" "FuenteMetrica" NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "SnapshotCuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanSemanal" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "proyectoVentaId" TEXT NOT NULL,
    "semanaInicio" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoPlan" NOT NULL DEFAULT 'BORRADOR',
    "presupuestoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "analisis" JSONB NOT NULL,
    "estrategia" TEXT NOT NULL,
    "generadoCon" TEXT NOT NULL DEFAULT 'plantilla',
    "creadoPorId" TEXT,
    "tokenAprobacionHash" TEXT,
    "tokenExpira" TIMESTAMP(3),
    "enviadoA" TEXT,
    "enviadoEn" TIMESTAMP(3),
    "decididoPor" TEXT,
    "decididoEn" TIMESTAMP(3),
    "comentarioDecision" TEXT,
    "metaCampaignId" TEXT,
    "metaResultado" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanSemanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PiezaPlan" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "plataforma" "PlataformaSocial" NOT NULL,
    "formato" "FormatoPieza" NOT NULL,
    "objetivo" "ObjetivoPauta" NOT NULL DEFAULT 'LEADS',
    "tema" TEXT NOT NULL,
    "pagada" BOOLEAN NOT NULL DEFAULT false,
    "presupuesto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diasPauta" INTEGER NOT NULL DEFAULT 0,
    "titular" TEXT NOT NULL,
    "copy" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "hashtags" TEXT,
    "conceptoVisual" TEXT NOT NULL,
    "guionVideo" TEXT,
    "estadoMeta" TEXT,
    "metaPostId" TEXT,
    "metaAdSetId" TEXT,
    "metaAdId" TEXT,
    "errorMeta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PiezaPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetricaPublicacion_empresaId_fechaPublicacion_idx" ON "MetricaPublicacion"("empresaId", "fechaPublicacion");

-- CreateIndex
CREATE UNIQUE INDEX "MetricaPublicacion_empresaId_plataforma_externoId_key" ON "MetricaPublicacion"("empresaId", "plataforma", "externoId");

-- CreateIndex
CREATE INDEX "SnapshotCuenta_empresaId_plataforma_fecha_idx" ON "SnapshotCuenta"("empresaId", "plataforma", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "PlanSemanal_tokenAprobacionHash_key" ON "PlanSemanal"("tokenAprobacionHash");

-- CreateIndex
CREATE INDEX "PlanSemanal_empresaId_semanaInicio_idx" ON "PlanSemanal"("empresaId", "semanaInicio");

-- CreateIndex
CREATE INDEX "PiezaPlan_planId_orden_idx" ON "PiezaPlan"("planId", "orden");

-- AddForeignKey
ALTER TABLE "ProyectoVenta" ADD CONSTRAINT "ProyectoVenta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricaPublicacion" ADD CONSTRAINT "MetricaPublicacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricaPublicacion" ADD CONSTRAINT "MetricaPublicacion_proyectoVentaId_fkey" FOREIGN KEY ("proyectoVentaId") REFERENCES "ProyectoVenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotCuenta" ADD CONSTRAINT "SnapshotCuenta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSemanal" ADD CONSTRAINT "PlanSemanal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSemanal" ADD CONSTRAINT "PlanSemanal_proyectoVentaId_fkey" FOREIGN KEY ("proyectoVentaId") REFERENCES "ProyectoVenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSemanal" ADD CONSTRAINT "PlanSemanal_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PiezaPlan" ADD CONSTRAINT "PiezaPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanSemanal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
