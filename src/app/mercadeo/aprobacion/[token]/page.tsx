import { AnalisisVista, MarkdownSimple, PiezaTarjeta, dinero, ESTADO_PLAN_LABEL } from "@/components/mercadeo-plan-vista";
import { AprobacionForm, CorreccionesProvider, NotaPieza } from "@/components/mercadeo-acciones";
import { planPorToken } from "@/lib/mercadeo/servicio";
import { estadoConfiguracionMeta } from "@/lib/mercadeo/meta";
import { correccionAutomaticaDisponible } from "@/lib/mercadeo/correcciones";
import type { Analisis } from "@/lib/mercadeo/analisis";
import { formatoFecha } from "@/lib/mercadeo/fechas";

export const dynamic = "force-dynamic";

// Página pública: el token del correo es la credencial (no requiere cuenta).
export default async function AprobacionPage({ params }: { params: { token: string } }) {
  const plan = await planPorToken(params.token);

  if (!plan) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">Enlace no válido</h1>
          <p className="text-gray-500 text-sm">
            Este enlace ya se usó, fue reemplazado por un envío más reciente o no existe. Si necesitas revisar el plan, pide
            que te lo reenvíen.
          </p>
        </div>
      </main>
    );
  }

  const vencido = plan.tokenExpira != null && plan.tokenExpira < new Date();
  const analisis = plan.analisis as unknown as Analisis;
  const pagadas = plan.piezas.filter((p) => p.pagada);
  const meta = estadoConfiguracionMeta();

  const pendiente = plan.estado === "PENDIENTE_APROBACION" && !vencido;
  const galeria = [...plan.proyectoVenta.imagenes, ...(plan.proyectoVenta.imagenUrl ? [plan.proyectoVenta.imagenUrl] : [])];
  const fotoDe = (p: (typeof plan.piezas)[number]) =>
    p.imagenFondo === "" ? null : p.imagenFondo || (galeria.length ? galeria[(p.orden - 1) % galeria.length] : null);

  return (
    <CorreccionesProvider>
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="text-xs text-gray-500 uppercase tracking-wide">Aprobación de plan de mercadeo</div>
        <h1 className="text-2xl font-bold mt-1">
          {plan.proyectoVenta.nombre} · semana del {formatoFecha(plan.semanaInicio)}
        </h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          {plan.piezas.length} publicaciones · {pagadas.length} con pauta · inversión total{" "}
          <strong>{dinero(plan.presupuestoTotal, plan.moneda)}</strong>
        </p>

        <div className="mb-8">
          {plan.estado !== "PENDIENTE_APROBACION" ? (
            <p className="text-sm bg-gray-50 border rounded-lg p-3">Este plan está: {ESTADO_PLAN_LABEL[plan.estado]}.</p>
          ) : vencido ? (
            <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">El enlace venció. Pide que se reenvíe el plan.</p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">
                Al aprobar:{" "}
                {meta.pagina || meta.instagram || meta.anuncios
                  ? `se programan las publicaciones y se crea la pauta en Meta${meta.activarAlAprobar ? " (activa de inmediato)" : " (en pausa, para activarla desde el Administrador de anuncios)"}. La pauta se cobra al método de pago de la cuenta publicitaria.`
                  : "Meta no está conectado; el equipo publicará las piezas manualmente."}
              </p>
              <AprobacionForm token={params.token} correccionAutomatica={correccionAutomaticaDisponible()} />
            </>
          )}
        </div>

        <h2 className="font-semibold text-lg mb-3">Análisis de las redes</h2>
        <div className="mb-8">
          <AnalisisVista analisis={analisis} />
        </div>
        <h2 className="font-semibold text-lg mb-3">Estrategia</h2>
        <div className="border rounded-xl bg-white p-5 mb-8">
          <MarkdownSimple texto={plan.estrategia} />
        </div>
        <h2 className="font-semibold text-lg mb-3">Calendario y piezas</h2>
        <div className="grid gap-3">
          {plan.piezas.map((p) => (
            <PiezaTarjeta key={p.id} pieza={p} moneda={plan.moneda}>
              {pendiente && <NotaPieza token={params.token} orden={p.orden} galeria={galeria} fotoActual={fotoDe(p)} />}
            </PiezaTarjeta>
          ))}
        </div>
      </div>
    </main>
    </CorreccionesProvider>
  );
}
