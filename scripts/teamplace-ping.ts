import "dotenv/config";
import { getToken, listarProductos } from "../src/lib/teamplace";

// Prueba de conexión con Teamplace: pide token y lista productos.
async function main() {
  const token = await getToken();
  console.log("✔ Token obtenido:", token.slice(0, 8) + "…");

  const productos = await listarProductos();
  console.log(`✔ Productos recibidos: ${productos.length}`);
  console.table(
    productos.slice(0, 5).map((p) => ({
      codigo: p.codigo,
      nombre: p.nombre,
      activo: p.activo,
    })),
  );
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
