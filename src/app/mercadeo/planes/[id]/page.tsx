import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/nav-bar";
import {
  AnalisisVista,
  ESTADO_PLAN_BADGE,
  ESTADO_PLAN_LABEL,
  MarkdownSimple,
  PiezaTarjeta,
  dinero,
} from "@/components/mercadeo-plan-vista";
import { CorregirPlanForm, EditorPieza, EnviarAprobacionForm, PlanAccionesSecundarias } from "@/components/mercadeo-acciones";
import { correccionAutomaticaDisponible } from "@/lib/mercadeo/correcciones";
import { AnalisisCreativoPieza, AnalizarTodasBoton } from "@/components/mercadeo-creativo";
import type { AnalisisCreativo } from "@/lib/mercadeo/creativo";
import type { Analisis } from "@/lib/mercadeo/analisis";
import { formatoFecha, formatoFechaHora } from "@/lib/mercadeo/fechas";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  const plan = await prisma.planSemanal.findFirst({
    where: { id: params.id, empresaId: user.empresaId ?? "" },
    include: { proyectoVenta: true, piezas: { orderBy: { orden: "asc" } } },
  });
  if (!plan) notFound();

  const analisis = plan.analisis as unknown as Analisis;
  const editable = plan.estado === "BORRADOR" || plan.estado === "RECHAZADO";
  const pagadas = plan.piezas.filter((p) => p.pagada);
  const historial = (Array.isArray(plan.historialCorrecciones) ? plan.historialCorrecciones : []) as Array<{
    fecha: string;
    autor: string;
    alcance: string;
    instrucciones: string;
    resumen: string;
  }>;
  const iaDisponible = correccionAutomaticaDisponible();
  const puedeAplicar = editable || plan.estado === "PENDIENTE_APROBACION";
  const resultadoMeta = plan.metaResultado as { fecha: string; resultados: Array<{ orden: number; ok: boolean; detalle: string }> } | null;

  return (
    <main className="min-h-screen">
      <NavBar />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link href="/mercadeo" className="text-sm text-gray-500 hover:underline">
          ← Mercadeo
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3 mt-2 mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              {plan.proyectoVenta.nombre} · semana del {formatoFecha(plan.semanaInicio)}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {plan.piezas.length} publicaciones · {pagadas.length} con pauta · inversión {dinero(plan.presupuestoTotal, plan.moneda)} ·
              contenido generado con {plan.generadoCon === "claude" ? "Claude" : "plantillas"}
            </p>
          </div>
          <span className={`text-sm px-3 py-1 rounded-full ${ESTADO_PLAN_BADGE[plan.estado]}`}>{ESTADO_PLAN_LABEL[plan.estado]}</span>
        </div>

        <section className="border rounded-xl bg-white p-5 mb-8 space-y-3">
          <h2 className="font-semibold">Aprobación</h2>
          {plan.estado === "RECHAZADO" && (
            <div className="text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              Rechazado por <strong>{plan.decididoPor}</strong>
              {plan.decididoEn && ` el ${formatoFechaHora(plan.decididoEn)}`}: {plan.comentarioDecision}
              <div className="text-xs text-gray-500 mt-1">Ajusta las piezas abajo y vuelve a enviarlo.</div>
            </div>
          )}
          {(plan.estado === "APROBADO" || plan.estado === "PUBLICADO") && (
            <div className="text-sm bg-green-50 border border-green-200 rounded-lg p-3">
              Aprobado por <strong>{plan.decididoPor}</strong>
              {plan.decididoEn && ` el ${formatoFechaHora(plan.decididoEn)}`}
              {plan.comentarioDecision && `: ${plan.comentarioDecision}`}
            </div>
          )}
          {plan.estado === "PENDIENTE_APROBACION" && (
            <p className="text-sm text-amber-700">
              Enviado a {plan.enviadoA}
              {plan.enviadoEn && ` el ${formatoFechaHora(plan.enviadoEn)}`}. Esperando decisión.
            </p>
          )}
          {(editable || plan.estado === "PENDIENTE_APROBACION") && (
            <EnviarAprobacionForm
              planId={plan.id}
              emailPorDefecto={process.env.MERCADEO_EMAIL_APROBACION ?? ""}
              enviadoA={plan.enviadoA}
            />
          )}
          {(editable || plan.estado === "PENDIENTE_APROBACION") && (
            <div className="border-t pt-4">
              <CorregirPlanForm
                planId={plan.id}
                piezas={plan.piezas.map((p) => ({ id: p.id, orden: p.orden, titular: p.titular }))}
                disponible={correccionAutomaticaDisponible()}
                hayDestinatario={Boolean(plan.enviadoA || process.env.MERCADEO_EMAIL_APROBACION)}
              />
            </div>
          )}
          {historial.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-600">Historial de correcciones ({historial.length})</summary>
              <ul className="mt-2 space-y-2">
                {historial
                  .slice()
                  .reverse()
                  .map((h, i) => (
                    <li key={i} className="border-l-2 border-brand-100 pl-3">
                      <div className="text-xs text-gray-500">
                        {formatoFechaHora(h.fecha)} · {h.autor} · {h.alcance}
                      </div>
                      <div className="text-gray-700">“{h.instrucciones}”</div>
                      <div className="text-gray-500">{h.resumen}</div>
                    </li>
                  ))}
              </ul>
            </details>
          )}
          {resultadoMeta && (
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-600">Resultado del envío a Meta ({formatoFechaHora(resultadoMeta.fecha)})</summary>
              <ul className="mt-2 space-y-1">
                {resultadoMeta.resultados.map((r) => (
                  <li key={r.orden} className={r.ok ? "text-gray-700" : "text-red-700"}>
                    #{r.orden}: {r.detalle}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <PlanAccionesSecundarias
            planId={plan.id}
            puedeBorrar={plan.estado !== "APROBADO" && plan.estado !== "PUBLICADO"}
            puedePublicar={(plan.estado === "APROBADO" || plan.estado === "PUBLICADO") && user.rolEmpresa === "ADMIN_EMPRESA"}
          />
        </section>

        <h2 className="font-semibold text-lg mb-3">Análisis de métricas</h2>
        <div className="mb-8">
          <AnalisisVista analisis={analisis} />
        </div>

        <h2 className="font-semibold text-lg mb-3">Estrategia</h2>
        <div className="border rounded-xl bg-white p-5 mb-8">
          <MarkdownSimple texto={plan.estrategia} />
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-semibold text-lg">Calendario y piezas</h2>
          <AnalizarTodasBoton
            disponible={iaDisponible}
            peticiones={plan.piezas
              .filter((p) => !p.analisisCreativo)
              .map((p) => ({ orden: p.orden, url: `/api/mercadeo/piezas/${p.id}/creativo`, cuerpo: {} }))}
          />
        </div>
        <div className="grid gap-3">
          {plan.piezas.map((p) => (
            <PiezaTarjeta key={p.id} pieza={p} moneda={plan.moneda}>
              <div className="flex gap-3 items-center">
                <a href={`/api/mercadeo/piezas/${p.id}/imagen?descargar=1`} className="text-xs text-gray-500 hover:underline mt-2">
                  Descargar imagen
                </a>
                {editable && (
                  <EditorPieza
                    planId={plan.id}
                    pieza={{
                      id: p.id,
                      titular: p.titular,
                      copy: p.copy,
                      cta: p.cta,
                      hashtags: p.hashtags,
                      pagada: p.pagada,
                      presupuesto: p.presupuesto,
                      imagenFondo: p.imagenFondo,
                    }}
                    imagenes={plan.proyectoVenta.imagenes}
                  />
                )}
              </div>
              <AnalisisCreativoPieza
                imagenUrl={`/api/mercadeo/piezas/${p.id}/imagen?v=${p.updatedAt.getTime()}`}
                analisis={p.analisisCreativo as unknown as AnalisisCreativo | null}
                endpoint={`/api/mercadeo/piezas/${p.id}/creativo`}
                cuerpo={{}}
                disponible={iaDisponible}
                puedeAplicar={puedeAplicar}
              />
            </PiezaTarjeta>
          ))}
        </div>
      </div>
    </main>
  );
}
