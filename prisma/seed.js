// Datos de ejemplo para probar la aplicación localmente.
// Ejecutar con: npm run db:seed

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10);

  // Empresa compradora
  const oasis = await prisma.empresa.create({
    data: {
      nombre: "Constructora Oasis SAS",
      tipo: "COMPRADOR",
      pais: "Colombia",
    },
  });

  const usuarioComprador = await prisma.usuario.create({
    data: {
      nombre: "Representante Legal",
      email: "comprador@oasis.com",
      passwordHash,
      rol: "COMPRADOR",
      empresaId: oasis.id,
    },
  });

  // Empresas proveedoras
  const solaire = await prisma.empresa.create({
    data: { nombre: "Solaire (distribuidor Jinko)", tipo: "PROVEEDOR", pais: "Colombia" },
  });
  const bluesun = await prisma.empresa.create({
    data: { nombre: "Bluesun Solar", tipo: "PROVEEDOR", pais: "China" },
  });
  const sungrow = await prisma.empresa.create({
    data: { nombre: "Sungrow", tipo: "PROVEEDOR", pais: "China" },
  });

  await prisma.usuario.create({
    data: {
      nombre: "Ventas Solaire",
      email: "ventas@solaire.com",
      passwordHash,
      rol: "PROVEEDOR",
      empresaId: solaire.id,
    },
  });

  // Categoría y productos
  const catPaneles = await prisma.categoriaProducto.create({
    data: { nombre: "Paneles solares" },
  });
  const catInversores = await prisma.categoriaProducto.create({
    data: { nombre: "Inversores" },
  });

  const panel = await prisma.producto.create({
    data: {
      nombre: "Panel bifacial TOPCon 620Wp",
      marca: "Jinko",
      modelo: "Tiger Neo",
      unidad: "unidad",
      precioRef: 95,
      moneda: "USD",
      categoriaId: catPaneles.id,
      proveedorId: solaire.id,
    },
  });

  const inversor = await prisma.producto.create({
    data: {
      nombre: "Inversor string 200kW",
      marca: "Sungrow",
      unidad: "unidad",
      precioRef: 8500,
      moneda: "USD",
      categoriaId: catInversores.id,
      proveedorId: sungrow.id,
    },
  });

  // Proyecto: Granja Solar 1ha
  const proyecto = await prisma.proyecto.create({
    data: {
      nombre: "Granja Solar 1ha",
      descripcion:
        "Proyecto de granja solar fotovoltaica de 1 hectárea, GD 800 kW AC.",
      estado: "COTIZACION",
      empresaId: oasis.id,
      creadoPorId: usuarioComprador.id,
      items: {
        create: [
          { productoId: panel.id, cantidad: 1560, unidad: "unidad" },
          { productoId: inversor.id, cantidad: 4, unidad: "unidad" },
        ],
      },
    },
  });

  await prisma.cotizacion.create({
    data: {
      proyectoId: proyecto.id,
      proveedorId: solaire.id,
      enviadaPorId: usuarioComprador.id,
      estado: "RECIBIDA",
      items: {
        create: [
          {
            productoId: panel.id,
            descripcion: "Panel bifacial TOPCon 620Wp",
            cantidad: 1560,
            precioUnit: 96.5,
            subtotal: 96.5 * 1560,
          },
        ],
      },
    },
  });

  // Segunda cotización de otro proveedor para el mismo panel, con precio distinto,
  // para que el comparador lado a lado tenga algo que mostrar.
  await prisma.cotizacion.create({
    data: {
      proyectoId: proyecto.id,
      proveedorId: bluesun.id,
      enviadaPorId: usuarioComprador.id,
      estado: "APROBADA",
      items: {
        create: [
          {
            productoId: panel.id,
            descripcion: "Panel bifacial TOPCon 620Wp",
            cantidad: 1560,
            precioUnit: 93.2,
            subtotal: 93.2 * 1560,
          },
        ],
      },
    },
  });

  console.log("Seed completado.");
  console.log("Usuario comprador: comprador@oasis.com / 123456");
  console.log("Usuario proveedor: ventas@solaire.com / 123456");
  console.log(`ID empresa Solaire (para pedir cotización): ${solaire.id}`);
  console.log(`ID empresa Bluesun: ${bluesun.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
