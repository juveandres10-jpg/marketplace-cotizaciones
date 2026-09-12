# Corre el sondeo diario de cotizaciones usando el CLI local de Claude Code.
# Pensado para el Programador de tareas de Windows (Task Scheduler).
#
# No contiene secretos: lee CRON_SECRET y APP_URL del archivo .env local
# (que nunca se sube a git) en tiempo de ejecucion.
#
# Requisitos:
#   - CLI instalado: npm install -g @anthropic-ai/claude-code
#   - Sesion iniciada:  claude setup-token   (una sola vez, manual)
#   - Este script vive en marketplace-app/scripts/

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath  = Join-Path $repoRoot ".env"
$logDir   = Join-Path $repoRoot "scripts"
$logPath  = Join-Path $logDir  "sondeo.log"

function Write-Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Add-Content -Path $logPath -Value $line
}

if (-not (Test-Path $envPath)) {
    Write-Log "ERROR: no existe .env en $envPath"
    exit 1
}

$envVars = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"]*)"?\s*$') {
        $envVars[$matches[1]] = $matches[2]
    }
}

$appUrl     = $envVars["APP_URL"]
$cronSecret = $envVars["CRON_SECRET"]

if ([string]::IsNullOrWhiteSpace($appUrl) -or [string]::IsNullOrWhiteSpace($cronSecret)) {
    Write-Log "ERROR: falta APP_URL o CRON_SECRET en .env"
    exit 1
}

$prompt = @"
Eres un agente NO INTERACTIVO (corres desatendido via Task Scheduler, nadie va a leer preguntas ni responderte). Tu unica tarea es el "sondeo diario de cotizaciones" del proyecto marketplace-cotizaciones. Ejecuta directamente los pasos de abajo sin explorar el resto del repositorio, sin listar archivos, sin comentar sobre otros archivos que encuentres (esta carpeta puede tener archivos sueltos de otros proyectos que NO tienen nada que ver con esta tarea - ignoralos por completo, no los leas ni los menciones). No hagas preguntas: si algo no esta claro, toma la decision mas conservadora (ver regla innegociable abajo) y sigue.

Contexto fijo:
- APP_URL = $appUrl
- CRON_SECRET = $cronSecret
- Usa el header ``Authorization: Bearer <CRON_SECRET>`` en TODAS las llamadas a {APP_URL}/api/sondeo/*.
- El UNICO archivo del repositorio que debes leer es docs/sondeo-runbook.md (seccion "Procedimiento"). Leelo y siguelo paso a paso: 1) GET worklist, 2) POST abrir revision, 3) por cada producto con faltantes>0 conseguir cotizaciones reales, 4) POST cargar cotizaciones, 5) PATCH cerrar la revision con resumen, 6) verificar con GET worklist de nuevo.

Como buscar proveedores:
- Fuente principal: Alibaba, usando urlBusquedaAlibaba / terminosBusqueda de cada item de la worklist.
- Usa WebFetch/WebSearch para intentar leer esas paginas o resultados equivalentes.
- Si Alibaba bloquea el acceso (captcha, verificacion) o no logras traer resultados utiles, NO inventes nada.

Regla innegociable: NUNCA inventes ni estimes nombres de proveedores, precios, paises, MOQ ni URLs. Cada cotizacion que subas debe venir de una fuente que realmente consultaste en esta corrida. Si para algun producto no logras conseguir cotizaciones reales, dejalo pendiente, anotalo en el resumen, y pon el estado de la revision en "PARCIAL" o "FALLIDA", explicando la causa.

Al terminar (SIEMPRE, incluso si la worklist vino vacia o algo fallo):
1. Cierra la revision (PATCH /api/sondeo/revisiones/{id}) con estado, contadores y un resumen en markdown.
2. No modifiques archivos del repositorio, no hagas commits ni pushes - esta tarea solo hace llamadas HTTP.
3. Termina con un resumen de 3-5 lineas en espanol. No termines con preguntas ni pidas confirmacion de nada - esta es tu unica oportunidad de actuar, nadie leera una pregunta.
"@

Write-Log "Iniciando sondeo diario..."
Push-Location $repoRoot
try {
    $output = & claude -p $prompt `
        --dangerously-skip-permissions `
        --allowedTools "Bash,Read,WebFetch,WebSearch,Grep,Glob" `
        --output-format text 2>&1
    Add-Content -Path $logPath -Value $output
    Write-Log "Sondeo terminado (exit code $LASTEXITCODE)."
} finally {
    Pop-Location
}
