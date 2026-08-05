import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildCategoriaSku, buildProductoSku, normalizarSegmento } from "../src/lib/sku";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Cat = { id: string; codigoSku: string };

async function makeCat(
  parent: Cat | null,
  segmento: string,
  nombre: string,
  descripcion: string | null,
  orden: number,
): Promise<Cat> {
  const seg = normalizarSegmento(segmento);
  const codigoSku = buildCategoriaSku(parent?.codigoSku ?? null, seg);
  const cat = await prisma.categoria.upsert({
    where: { codigoSku },
    update: { nombre, descripcion, orden },
    create: { parentId: parent?.id ?? null, segmento: seg, nombre, descripcion, codigoSku, orden },
  });
  return { id: cat.id, codigoSku: cat.codigoSku };
}

async function makeProd(
  cat: Cat,
  secuencia: number,
  nombre: string,
  opts: {
    estado?: "ACTIVO" | "INACTIVO";
    cantidadStock?: number;
    unidadStock?: string;
    lugar?: string;
    descripcion?: string;
  } = {},
) {
  const codigoSku = buildProductoSku(cat.codigoSku, secuencia);
  const data = {
    nombre,
    descripcion: opts.descripcion ?? null,
    estado: opts.estado ?? "ACTIVO",
    cantidadStock: opts.cantidadStock ?? 0,
    unidadStock: opts.unidadStock ?? "UNI",
    lugar: opts.lugar ?? null,
  };
  await prisma.producto.upsert({
    where: { codigoSku },
    update: data,
    create: { categoriaId: cat.id, secuencia, codigoSku, ...data },
  });
}

async function main() {
  await prisma.user.upsert({
    where: { email: "admin@centralsm.local" },
    update: {},
    create: { email: "admin@centralsm.local", nombre: "Administrador", rol: "ADMIN" },
  });

  // --- Categorías Macro -----------------------------------------------------
  await makeCat(null, "EC", "Equipamiento de cliente y Servicios finales",
    "Termina instalado, vendido o entregado al cliente para prestar internet, TV, IPTV o seguridad", 0);
  const ir = await makeCat(null, "IR", "Infraestructura de red y telecomunicaciones",
    "Todo lo que construye, transporta, distribuye o administra la red del proveedor", 1);
  await makeCat(null, "EN", "Energía, soporte técnico y activos operativos",
    "Todo lo que permite que la operación funcione internamente y de forma estable", 2);
  await makeCat(null, "HE", "Herramientas, instalación, mantenimiento y seguridad",
    "Todo lo que usa el personal para instalar, reparar, montar, medir o trabajar seguro", 3);
  await makeCat(null, "IL", "Insumos, repuestos, laboratorio y depuración",
    "Todo lo que se consume, repara, recupera, descarta o debe limpiarse del catálogo", 4);

  // --- IR -> subcategorías ---------------------------------------------------
  const ir1 = await makeCat(ir, "1", "Cables y Fibra", null, 0);
  await makeCat(ir, "2", "Conectores y Empalmes", null, 1);

  // --- IR-1 -> subcategorías -------------------------------------------------
  const ads = await makeCat(ir1, "ADS", "Fibra ADSS",
    "All dielectric self supporting: para planta externa, en tendidos aéreos entre postes. Totalmente dieléctrica (no conduce electricidad) y autosoportada.", 0);
  await makeCat(ir1, "FDR", "Fibra Drop", null, 1);
  await makeCat(ir1, "FDI", "Fibra Óptica Dieléctrica", null, 2);
  await makeCat(ir1, "RG6", "Coaxial - RG6", null, 3);

  // --- IR-1-ADS -> artículos -------------------------------------------------
  await makeProd(ads, 1, "Fibra ADSS 12 Pelos", {
    estado: "ACTIVO",
    cantidadStock: 1000,
    lugar: "Diego de Villarroel 257, T4000 San Miguel de Tucumán, Argentina",
  });
  await makeProd(ads, 2, "Fibra ADSS 24 Pelos");
  await makeProd(ads, 3, "Fibra ADSS 24 Pelos 200 M");
  await makeProd(ads, 4, "Fibra ADSS 36 Pelos");
  await makeProd(ads, 9, "Fibra 12 Pelos (Recortes)", { estado: "INACTIVO" });
  await makeProd(ads, 10, "Fibra 16 Pelos (Recortes)", { estado: "INACTIVO" });

  console.log("Seed del catálogo completado ✔");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
