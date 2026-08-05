# Alta de productos en CentralSM → Finnegans Go

Feature integrada: cargás un producto en CentralSM con **los mismos campos que Finnegans**, y al
guardar se dispara un bot de **Playwright** que lo da de alta en **Finnegans Go** automáticamente.

Hay **dos puertas de entrada**, las dos disparan el mismo bot:

| Dónde | Cuándo usarla |
|-------|---------------|
| **Catálogo → "Nuevo artículo"** → tildar *"Cargar también en Finnegans Go"* + Código | El alta de siempre; lo más rápido |
| [**`/productos/nuevo`**](../src/app/productos/nuevo/page.tsx) | Cuando necesitás todos los campos (Tipo, Rubro, Marca, Familia, flags) |

- **Listado + estado:** [`/productos`](../src/app/productos/page.tsx)
- Detalle del flujo Playwright (rutas, iframe, `tabindex`): [`carga-productos-playwright.md`](./carga-productos-playwright.md) §5

> ⚠️ El alta del catálogo **sin** tildar la opción sigue siendo local (queda en `NO_APLICA`) — no se
> empuja nada. Es el comportamiento previo, intacto.

---

## 1. Cómo funciona

```
[Formulario /productos/nuevo]
        │  server action crearProductoYEmpujar()
        ▼
[1] Guarda el Producto en Postgres (SKU local + campos Finnegans)
[2] Crea un FinnegansPushJob (PENDIENTE)  ← la app termina acá: solo encola
        │
        ▼
[Postgres: FinnegansPushJob]  ◄── polling/claim ──  [microservicio worker]
        ▲                          (contenedor centralsm-worker, worker/README.md)
        │                                    │
[UI hace polling]                            ▼
GET /api/finnegans-push/<jobId>   [bot Playwright, headless]
                                  login → /mas/vista?viewID=104
                                  → "Nuevo" → completa el form
                                  → "Guardar" → verifica
                                  → actualiza el job en la base
```

El alta local es **síncrona** (el producto queda en tu base al instante). El push a Finnegans lo
procesa el **microservicio worker** en su propio contenedor (patrón DB-as-queue: la tabla
`FinnegansPushJob` es la cola; la app y el worker solo se hablan a través de Postgres). La UI
muestra el progreso en vivo ("Iniciando el navegador…" → "Playwright está cargando…" → "¡Listo!").

## 2. Campos

Espejan 1:1 la pestaña **General** del alta de Finnegans Go:

| Grupo | Campos |
|-------|--------|
| Identificación | **Código\***, **Nombre\***, Descripción, **Tipo\*** (default `Otros`), Peso, Volumen |
| Clasificación | Rubro, Marca, Familia, SubFamilia *(campos F4: el valor debe existir en Finnegans)* |
| Opciones | Activo, Es Stockeable, Se vende, Se Compra, Maneja Retenciones |
| Solo CentralSM | Categoría del catálogo (define el SKU local; **no** se envía a Finnegans) |

\* Obligatorios en Finnegans. En la práctica alcanza con **Código + Nombre** (Tipo ya viene `Otros`).

El **Código** se guarda en `Producto.teamplaceCodigo` — que es la misma llave con la que el pull
diario (`npm run teamplace:sync`) vincula los productos. Así el producto creado acá y el de Finnegans
quedan enlazados, sin duplicarse en la próxima sincronización.

## 3. Modelo de datos

En `Producto` se agregaron los campos de Finnegans (`finnegansTipo`, `finnegansPeso`,
`finnegansVolumen`, `finnegansRubro`, `finnegansMarca`, `finnegansFamilia`, `finnegansSubFamilia`,
`finnegansActivo`, `esStockeable`, `seVende`, `seCompra`, `manejaRetenciones`) más el estado del push:

```prisma
finnegansPushEstado EstadoPushFinnegans @default(NO_APLICA)
finnegansPushAt     DateTime?
finnegansPushError  String?
```

`EstadoPushFinnegans` = `NO_APLICA | PENDIENTE | EN_PROCESO | SINCRONIZADO | ERROR`.

> Los ~3200 productos que vinieron del pull quedan en **`NO_APLICA`**: ya existen en Finnegans, no hay
> nada que empujar. Solo los creados desde CentralSM arrancan en `PENDIENTE`.

`FinnegansPushJob` es la bitácora de cada corrida del bot (estado, intento, error, log, tiempos).

Migración: `prisma/migrations/…_productos_finnegans_push/`.

## 4. Configuración

En `.env` (ver `.env.example`):

```dotenv
FINNEGANS_USER="impuestos@multireg.com.ar"
FINNEGANS_PASSWORD="********"
FINNEGANS_WORKSPACE="MULTIMEDIOS"
FINNEGANS_PRODUCTOS_URL="https://go.finneg.com/mas/vista?viewID=104"
FINNEGANS_PUSH_HEADLESS="true"     # "false" para ver el navegador al depurar
```

Requisitos en el host: `npm i -D playwright && npx playwright install chromium` (ya instalados).

### En Docker

El bot corre **dentro del contenedor `app`**, así que la imagen necesita Chromium y sus librerías
del sistema. Ya está resuelto:

- `Dockerfile` (etapa `dev`) acepta `ARG INSTALL_PLAYWRIGHT`; si vale `true` corre
  `npx playwright install --with-deps chromium` y fija `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`.
- `docker-compose.yml` lo activa **solo en `app`** (`build.args.INSTALL_PLAYWRIGHT: "true"`).
  El servicio `cron` lo deja en `false` para no cargar ~400 MB que no usa.
- Las `FINNEGANS_*` se pasan al contenedor `app` desde tu `.env` (Compose las sustituye).

> La primera build de `app` descarga Chromium: tarda bastante más y engorda la imagen ~400 MB.
> Si no querés el bot en Docker, poné `INSTALL_PLAYWRIGHT: "false"` y usá la app en el host.

**Build inestable (`ECONNRESET` en `npm install`):** el `Dockerfile` monta la cache de npm como
cache de BuildKit y sube reintentos/timeouts, así un corte de red no obliga a bajar todo de nuevo.
Si aun así falla, simplemente reintentá el build: reaprovecha lo ya descargado.

### ⚠️ Gotcha: el volumen anónimo de `node_modules`

`docker-compose.yml` monta `- /app/node_modules` como **volumen anónimo** para que los
`node_modules` del contenedor (Linux) no sean pisados por los del host (Windows). El problema: ese
volumen **persiste entre `up`/`down` y tapa los `node_modules` de la imagen**. Si agregás una
dependencia y reconstruís, el contenedor **sigue usando las viejas** → `Cannot find module 'x'`.

Cada vez que cambien las dependencias:

```bash
docker compose build app
docker compose up -d --force-recreate --renew-anon-volumes app
```

`--renew-anon-volumes` recrea **solo** los volúmenes anónimos (`node_modules`, `.next`).
**No toca los volúmenes con nombre** (`pgdata` = la base, `uploads` = las imágenes).

> ❌ **Nunca uses `docker compose down -v`** para esto: eso sí borra `pgdata` y `uploads`.

## 5. Archivos

| Archivo | Rol |
|---------|-----|
| [`src/lib/finnegans-producto.ts`](../src/lib/finnegans-producto.ts) | Esquema zod + mapa de campos (fuente única) |
| [`src/app/productos/actions.ts`](../src/app/productos/actions.ts) | Server action: guarda + encola el job |
| [`src/lib/finnegans-push.ts`](../src/lib/finnegans-push.ts) | Encola el job (la cola es la tabla `FinnegansPushJob`) |
| [`worker/index.ts`](../worker/index.ts) | Microservicio worker: polling de la cola, claim y ciclo de vida |
| [`scripts/playwright/push-producto.ts`](../scripts/playwright/push-producto.ts) | Bot Playwright (1 producto); también corre a mano para debug |
| [`src/app/api/finnegans-push/[jobId]/route.ts`](../src/app/api/finnegans-push/%5BjobId%5D/route.ts) | Polling del estado |
| [`src/components/productos/producto-finnegans-form.tsx`](../src/components/productos/producto-finnegans-form.tsx) | Formulario + progreso en vivo |
| [`src/lib/productos.ts`](../src/lib/productos.ts) | Consultas (categorías, listado con estado) |

## 6. Estado de verificación

- ✅ **Selectores**: todos verificados volcando el DOM real con
  `docker compose exec worker npx tsx scripts/playwright/inspeccionar-form.ts` (el único contenedor
  con Chromium es el del worker). Campos y checkboxes se
  targetean por su widget contenedor (`div.widget[name="wdg_X"] input`), que es estable.
- ✅ **Login, navegación y llenado**: funcionan headless dentro del contenedor.
- ⚠️ **Pendiente de confirmar**: un alta completa de punta a punta con la versión corregida.

**Bugs encontrados y corregidos (2026-07-24)** — útiles si algo vuelve a fallar:

| Bug | Síntoma | Causa | Fix |
|-----|---------|-------|-----|
| Botón equivocado | Timeout esperando "Eliminar", form vacío en la captura | `getByRole(name:'Guardar')` matchea por substring → agarraba **"Guardar y nuevo"** | `exact: true` |
| Checkbox "Activo" | "No pude marcar el checkbox Activo" | `#CKBox_first` es el checkbox de la **cabecera de la grilla**, no el del form | `wdg_activo` |
| Sin feedback | Job colgado en PENDIENTE | `spawn` con `stdio:"ignore"` se comía los errores | Captura stdout/stderr al job |
| Módulo faltante | `Cannot find module 'playwright'` | Volumen anónimo de `node_modules` obsoleto | `--renew-anon-volumes` |

> 🏢 **Ojo con la Empresa.** El bot loguea limpio y toma la **empresa por defecto** del usuario
> (en las pruebas: `PROVIDERS SA`). Si necesitás que los productos caigan en otra empresa, hay que
> seleccionarla después del login — hoy el runner **no** lo hace.

## 7. Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| Cargué un producto y no pasó nada | Lo creaste desde el catálogo **sin** tildar "Cargar también en Finnegans Go" | Tildá la opción y completá el Código, o usá `/productos/nuevo` |
| `Cannot find module 'playwright'` en el contenedor | **Volumen anónimo obsoleto** (ver abajo) | `docker compose up -d --force-recreate --renew-anon-volumes worker` |
| Queda en `PENDIENTE` y después da error | El worker no está corriendo | `docker compose ps worker` y `docker compose logs worker`; o probá el bot a mano: `npx tsx scripts/playwright/push-producto.ts <jobId>` |
| `ERROR` con "El login no avanzó" | Credenciales/workspace mal en `.env` | Revisá `FINNEGANS_USER/PASSWORD/WORKSPACE` |
| `ERROR` con timeout esperando "Eliminar" | Validación de Finnegans rechazó el alta | Mirá la captura en `scripts/playwright/resultados/push-error-<jobId>.png` |
| El producto se creó pero inactivo | No se pudo marcar "Activo" | Ver §6; revisá el `log` del job |
| `viewID` no existe | Otro workspace/empresa | Sacá el tuyo: buscador global → "producto" → tile "Productos" → copiá la URL |

> El runner corre con `FINNEGANS_PUSH_HEADLESS=false` si querés **ver** qué hace el navegador.
