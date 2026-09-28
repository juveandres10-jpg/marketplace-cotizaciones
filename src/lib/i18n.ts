export type Locale = "es" | "en";

export const locales: Locale[] = ["es", "en"];
export const defaultLocale: Locale = "es";
export const LOCALE_COOKIE = "locale";

// Nota: sin `as const` a propósito — así `es` y `en` son estructuralmente
// idénticos (mismos tipos `string`) y `getDictionary` puede devolver cualquiera
// de los dos como `Dictionary`. Con `as const`, "Proyectos" y "Projects" serían
// tipos literales distintos y `en` no sería asignable a `Dictionary`.
export const dictionaries = {
  es: {
    nav: {
      brand: "Marketplace",
      proyectos: "Proyectos",
      catalogo: "Catálogo",
      sondeo: "Sondeo",
      mercadeo: "Mercadeo",
      salir: "Salir",
    },
    landing: {
      titulo: "Marketplace de Cotizaciones",
      subtitulo:
        "Busca y compara productos entre proveedores, y gestiona las cotizaciones de cada uno de tus proyectos en un solo lugar.",
      iniciarSesion: "Iniciar sesión",
      crearCuenta: "Crear cuenta",
    },
    auth: {
      iniciarSesion: "Iniciar sesión",
      email: "Email",
      contrasena: "Contraseña",
      ingresar: "Ingresar",
      ingresando: "Ingresando...",
      noTienesCuenta: "¿No tienes cuenta?",
      registrate: "Regístrate",
      credencialesInvalidas: "Email o contraseña incorrectos",
      crearCuentaTitulo: "Crear cuenta",
      tipoCuenta: "Tipo de cuenta",
      opcionComprador: "Comprador (busco y cotizo productos)",
      opcionProveedor: "Proveedor (publico productos)",
      tuNombre: "Tu nombre",
      nombreEmpresa: "Nombre de la empresa",
      nit: "NIT (opcional)",
      pais: "País",
      crearCuentaBtn: "Crear cuenta",
      creandoCuenta: "Creando cuenta...",
      yaTienesCuenta: "¿Ya tienes cuenta?",
      iniciaSesion: "Inicia sesión",
    },
    dashboard: {
      tusProyectos: "Tus proyectos",
      nuevoProyecto: "+ Nuevo proyecto",
      sinProyectos:
        "Aún no tienes proyectos. Crea uno para empezar a gestionar cotizaciones.",
      itemsBom: "ítems en BOM",
      cotizaciones: "cotizaciones",
    },
    proyecto: {
      bom: "Lista de materiales (BOM)",
      sinItems: "Este proyecto aún no tiene ítems en su BOM.",
      producto: "Producto",
      cantidad: "Cantidad",
      unidad: "Unidad",
      notas: "Notas",
      comparador: "Comparador de cotizaciones",
      comparadorNota:
        "En verde: el precio unitario más bajo disponible por ítem. \"Pendiente\" = el proveedor aún no ha respondido precio.",
      cotizaciones: "Cotizaciones",
      exportarExcel: "Exportar aprobadas a Excel",
      exportarPdf: "Exportar aprobadas a PDF",
    },
    productos: {
      titulo: "Catálogo de productos",
      buscarPlaceholder: "Buscar por nombre o marca (ej: panel, Jinko, inversor)",
      buscar: "Buscar",
      sinResultados: "No se encontraron productos.",
      proveedor: "Proveedor",
    },
    cotizaciones: {
      solicitar: "+ Solicitar cotización",
      cancelar: "Cancelar",
      sinCotizaciones: "Aún no se han enviado cotizaciones para este proyecto.",
      item: "Ítem",
      cant: "Cant.",
      precioUnit: "Precio unit.",
      subtotal: "Subtotal",
      cambiarEstado: "Cambiar estado:",
      adjuntos: "Archivos adjuntos (fichas técnicas, PDF de cotización, etc.)",
      adjuntar: "+ Adjuntar archivo",
      subiendo: "Subiendo...",
      subidoPor: "subido por",
      proveedor: "Proveedor",
      descripcionItem: "Descripción del ítem",
      notas: "Notas",
      enviarSolicitud: "Enviar solicitud",
      seleccionaProveedor: "Selecciona un proveedor",
      cargandoProveedores: "Cargando proveedores...",
      pendiente: "pendiente",
    },
  },
  en: {
    nav: {
      brand: "Marketplace",
      proyectos: "Projects",
      catalogo: "Catalog",
      sondeo: "Sourcing",
      mercadeo: "Marketing",
      salir: "Sign out",
    },
    landing: {
      titulo: "Quotation Marketplace",
      subtitulo:
        "Search and compare products across suppliers, and manage quotations for each of your projects in one place.",
      iniciarSesion: "Sign in",
      crearCuenta: "Create account",
    },
    auth: {
      iniciarSesion: "Sign in",
      email: "Email",
      contrasena: "Password",
      ingresar: "Sign in",
      ingresando: "Signing in...",
      noTienesCuenta: "Don't have an account?",
      registrate: "Sign up",
      credencialesInvalidas: "Incorrect email or password",
      crearCuentaTitulo: "Create account",
      tipoCuenta: "Account type",
      opcionComprador: "Buyer (I search and request quotes)",
      opcionProveedor: "Supplier (I publish products)",
      tuNombre: "Your name",
      nombreEmpresa: "Company name",
      nit: "Tax ID (optional)",
      pais: "Country",
      crearCuentaBtn: "Create account",
      creandoCuenta: "Creating account...",
      yaTienesCuenta: "Already have an account?",
      iniciaSesion: "Sign in",
    },
    dashboard: {
      tusProyectos: "Your projects",
      nuevoProyecto: "+ New project",
      sinProyectos:
        "You don't have any projects yet. Create one to start managing quotations.",
      itemsBom: "items in BOM",
      cotizaciones: "quotations",
    },
    proyecto: {
      bom: "Bill of materials (BOM)",
      sinItems: "This project doesn't have any BOM items yet.",
      producto: "Product",
      cantidad: "Quantity",
      unidad: "Unit",
      notas: "Notes",
      comparador: "Quotation comparison",
      comparadorNota:
        'Green: the lowest available unit price per item. "Pending" = the supplier hasn\'t responded with a price yet.',
      cotizaciones: "Quotations",
      exportarExcel: "Export approved to Excel",
      exportarPdf: "Export approved to PDF",
    },
    productos: {
      titulo: "Product catalog",
      buscarPlaceholder: "Search by name or brand (e.g. panel, Jinko, inverter)",
      buscar: "Search",
      sinResultados: "No products found.",
      proveedor: "Supplier",
    },
    cotizaciones: {
      solicitar: "+ Request quotation",
      cancelar: "Cancel",
      sinCotizaciones: "No quotations have been sent for this project yet.",
      item: "Item",
      cant: "Qty.",
      precioUnit: "Unit price",
      subtotal: "Subtotal",
      cambiarEstado: "Change status:",
      adjuntos: "Attached files (spec sheets, quotation PDFs, etc.)",
      adjuntar: "+ Attach file",
      subiendo: "Uploading...",
      subidoPor: "uploaded by",
      proveedor: "Supplier",
      descripcionItem: "Item description",
      notas: "Notes",
      enviarSolicitud: "Send request",
      seleccionaProveedor: "Select a supplier",
      cargandoProveedores: "Loading suppliers...",
      pendiente: "pending",
    },
  },
};

export type Dictionary = (typeof dictionaries)["es"];

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}
