<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CentralSM

Plataforma interna para centralizar el stock management de la empresa (ISP), integrada con la API de Teamplace / Finnegans (`docs/API-Teamplace-Finnegans.md`). Todo el código, UI y comentarios están **en español**.

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack, `output: "standalone"`)
- shadcn/ui sobre **Base UI** (`@base-ui/react`, no Radix) + Tailwind v4
- PostgreSQL 17 · Prisma 7 con adapter `@prisma/adapter-pg` (cliente generado en `src/generated/prisma`)
- Docker Compose para dev (app en host `:3100`, Postgres en `:5433`) y producción (`docker-compose.prod.yml`)

## Módulos (rutas en `src/app/`)

- `/dashboard` — KPIs de la última sincronización, productos nuevos, cambios de stock e historial de corridas. Acepta `?run=<syncRunId>` para ver el estado de una corrida anterior (vista histórica: KPIs desde `SyncRun`, cambios desde `HistorialStock`, niveles desde `SnapshotStock`).
- `/dashboard/movimientos` — histórico de entradas/salidas por producto y depósito (`?dias=7|30|90`).
- `/catalogo` — módulo unificado con tabs (`CatalogoTabs`):
  - **Categorías** (`/catalogo`, `/catalogo/[id]`, `/catalogo/articulo/[id]`) — árbol de categorías con SKU por capas (`#IR-1-ADS-0001`).
  - **Clasificar** (`/catalogo/clasificar`) — mesa de trabajo para catalogar a mano: lista paginada server-side (`?q=&cat=pendientes|todas|<categoriaId>&stock=1&orden=nombre|stock|reciente&pagina=`), selección múltiple (clic en fila / Shift+clic / toda la página) y «Mover a…» con `CategoriaPicker` (búsqueda por ruta+SKU, recientes en localStorage, crear subcategoría inline). Por defecto muestra el subárbol `#REV` (lo que el sync no supo clasificar). Acción `moverProductos(ids, categoriaId)` en `catalogo/actions.ts` (regenera `secuencia`+`codigoSku`, dos pasadas con SKU temporal) y `deshacerMovida` para el toast de deshacer. El mismo `MoverArticulosDialog` se usa en la ficha del artículo y en el hover de `ArticuloCard`. Datos en `src/lib/catalogo.ts` (`getCategoriasPlanas`, `buscarArticulosParaClasificar`, `contarPendientes`); tipos/constantes compartidos cliente-servidor en `src/lib/catalogo-tipos.ts` (no importar `lib/catalogo.ts` desde componentes cliente: arrastra Prisma).
  - **Verificación de categorías** — flag manual `Categoria.verificadaAt/verificadaPor` (texto libre hasta que haya usuarios). Estado derivado en `getVerificacionPorCategoria()` (`src/lib/catalogo.ts`, una query raw): `verificada`, o `con_cambios` si algún `Producto.clasificadoAt` (se setea al crear y en `moverProductos`) o `Categoria.createdAt` de un hijo es posterior a `verificadaAt`. Acciones `verificarCategoria(id, nombre)` / `quitarVerificacionCategoria(id)`; UI en `VerificacionBadge` (cards, header de categoría, picker) y `VerificarCategoriaButton` (marcar / re-verificar + «Ver cambios» / quitar). Tipos en `src/lib/verificacion-tipos.ts`.
  - **Altas Finnegans** (`/catalogo/altas`, `/catalogo/altas/nuevo`) — altas locales que un bot Playwright (worker separado) carga en Finnegans Go; estado de push por producto.
  - **Ficha operativa** (`/catalogo/articulo/[id]/ficha`) — investigación operativa por artículo, tres pestañas: maestro (segmentación, proveedores con precios, lead times), movimientos clasificados por tipo (solo CONSUMO es demanda) y derivado (ADI/CV² → patrón Syntetos-Boylan → política de compra, stock de seguridad Z=1,65, punto de pedido, sugerencia q, ABC, kit). Motor puro en `src/lib/ficha.ts` (verificado contra el prototipo), datos en `src/lib/ficha-data.ts`, UI en `src/components/ficha/`.
- `/depositos` — existencias por depósito.
- `/login` — auth simple (`src/lib/auth.ts`, proxy en `src/proxy.ts`).

No existe más el módulo Teamplace en el frontend (se eliminó por redundante); `next.config.ts` redirige `/productos*` y `/teamplace` a sus reemplazos. La integración Teamplace vive solo en backend: `src/lib/teamplace.ts` (cliente API), `src/lib/teamplace-jobs.ts` (sync diario) y `scripts/teamplace-*.ts`.

## Arquitectura de datos (ver `prisma/schema.prisma`)

- `Categoria` (árbol auto-referenciado, cada capa aporta un segmento del SKU) → `Producto` (hoja con correlativo).
- Sync diario (cron 2 AM, `scripts/cron.ts` → `teamplace-jobs.ts`): cada corrida crea un `SyncRun` (con `ejecutadoAt` al **final** de la corrida) + `HistorialStock` (deltas por producto/depósito) + `SnapshotStock` (niveles absolutos completos del día).
- Altas hacia Finnegans: `FinnegansPushJob` como cola en DB; el worker (`worker/`, contenedor propio) la procesa con Playwright. La UI hace polling vía `/api/finnegans-push/[jobId]`.

## Convenciones

- Botones/links de shadcn sobre Base UI: `render={<Link href=... />}` + `nativeButton={false}` (no `asChild`).
- Páginas con datos: `export const dynamic = "force-dynamic"` y `searchParams`/`params` son **Promise** (hay que `await`).
- Server actions en `actions.ts` junto a la ruta; devuelven `{ ok, ... } | { ok: false, error }`.
- Fechas con `fechaHoraAR` (`src/lib/fecha.ts`); números con `toLocaleString("es-AR")`.

## Comandos

```bash
docker compose up -d --build   # dev: app :3100 + Postgres :5433 (hot reload por polling)
npm run build                  # build de producción (typecheck incluido)
npm run lint                   # eslint
npm run db:migrate             # prisma migrate dev
npm run db:generate            # regenerar cliente Prisma (src/generated/prisma)
npm run sync:daily             # corrida manual del sync
npx tsx scripts/importar-kardex.ts scripts/kardex-24m.jsonl --apply  # recargar movimientos del kardex (fuente=KARDEX)
npx tsx scripts/verificar-ficha.ts [codigos]                         # chequeo rápido del derivado post-import
npm run teamplace:ping         # probar credenciales de la API Teamplace
npm run worker                 # worker de altas Finnegans (normalmente en su contenedor)
```

Si `npx tsc --noEmit` falla con módulos inexistentes bajo `.next/`, son tipos generados viejos: borrar `.next` y usar `npm run build`.

Producción: servidor LAN `192.168.100.108:3100` (ver `docs/` y `k8s/`).
