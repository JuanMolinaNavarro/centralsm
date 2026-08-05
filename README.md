# CentralSM

Plataforma para **centralizar el stock management y otras actividades** de la
empresa, integrada con la API de **Teamplace / Finnegans**
(ver [`docs/API-Teamplace-Finnegans.md`](docs/API-Teamplace-Finnegans.md)).

## Stack

| Capa            | Tecnología                          |
| --------------- | ----------------------------------- |
| Framework       | Next.js 16 (App Router, TypeScript) |
| UI              | shadcn/ui (Base UI) + Tailwind v4   |
| Base de datos   | PostgreSQL 17                       |
| ORM             | Prisma 7 (adapter `@prisma/adapter-pg`) |
| Contenedores    | Docker Compose con hot reload       |

## Requisitos

- Docker Desktop (Compose v2)
- Node.js 22+ (solo para correr herramientas en el host: lint, prisma studio, etc.)

## Puesta en marcha (Docker)

```bash
# 1. Copiar variables de entorno
cp .env.example .env

# 2. Levantar el stack (Postgres + app con hot reload)
docker compose up -d --build

# 3. Crear/aplicar la migración inicial (solo la primera vez)
docker compose exec app npx prisma migrate dev --name init

# 4. (Opcional) Cargar datos de ejemplo
docker compose exec app npm run db:seed
```

La app queda en **http://localhost:3100** y Postgres en **localhost:5433**.

> ℹ️ Se usan los puertos 3100/5433 en el host para no chocar con otros
> servicios que ya ocupan 3000/3001/5432 en esta máquina. Dentro de la red de
> Docker, la app y la base siguen usando 3000 y 5432.

### Hot reload

El código se monta por bind-mount y el dev server corre con polling
(`WATCHPACK_POLLING`), necesario porque el proyecto vive en el filesystem de
Windows (los eventos `inotify` no cruzan al contenedor Linux). Editás un archivo
en el host y se recompila automáticamente.

## Comandos útiles

```bash
docker compose logs -f app          # logs del dev server
docker compose exec app sh          # shell dentro del contenedor
docker compose down                 # frenar (conserva datos)
docker compose down -v              # frenar y BORRAR la base (destructivo)
```

### Prisma (dentro del contenedor o en el host)

| Script              | Acción                                          |
| ------------------- | ----------------------------------------------- |
| `npm run db:generate` | Genera el cliente de Prisma                   |
| `npm run db:migrate`  | Crea y aplica una migración (dev)             |
| `npm run db:deploy`   | Aplica migraciones existentes (prod/CI)       |
| `npm run db:push`     | Sincroniza el schema sin migración (prototipo)|
| `npm run db:studio`   | Abre Prisma Studio                            |
| `npm run db:seed`     | Carga datos de ejemplo                        |

> En el **host**, Prisma usa `DATABASE_URL` de `.env` (apunta a
> `localhost:5433`). Dentro de **Docker**, `docker-compose.yml` sobreescribe
> `DATABASE_URL` para apuntar al host `db`.

## Catálogo de productos

En **http://localhost:3100/catalogo**. Es un árbol de categorías (estilo Notion)
donde cada capa aporta un fragmento al SKU:

```
Macro  #IR        Infraestructura de red
 └ sub  #IR-1      Cables y Fibra
    └ sub #IR-1-ADS  Fibra ADSS
       └ artículo #IR-1-ADS-0001  Fibra ADSS 12 Pelos
```

- **Fragmento manual por categoría** (`IR`, `1`, `ADS`); el artículo recibe un
  **correlativo automático de 4 dígitos**. Ver [src/lib/sku.ts](src/lib/sku.ts).
- **CRUD completo** de categorías/subcategorías y artículos (crear, editar,
  eliminar) vía Server Actions ([src/app/catalogo/actions.ts](src/app/catalogo/actions.ts)).
  Al renombrar el fragmento de una categoría se **recalcula el SKU de todo el subárbol**.
- **Imágenes** por categoría y artículo: se suben a `/api/uploads` y se guardan en
  disco (volumen Docker `uploads`, dir `UPLOADS_DIR`). Ver [src/lib/uploads.ts](src/lib/uploads.ts).

## Estructura

```
src/
  app/
    catalogo/                  # catálogo (páginas + server actions)
    api/uploads/               # subir y servir imágenes
  components/
    ui/                        # componentes shadcn/ui
    catalogo/                  # cards, formularios y diálogos del catálogo
  lib/
    prisma.ts                  # singleton de PrismaClient (adapter pg)
    sku.ts                     # construcción/validación de SKU
    uploads.ts                 # almacenamiento de imágenes
    catalogo.ts                # consultas del catálogo
  generated/prisma/            # cliente de Prisma generado (no se commitea)
prisma/
  schema.prisma                # Categoria, Producto, Deposito, Stock, Movimiento, User
  seed.ts                      # catálogo de ejemplo (árbol #IR)
docs/
  API-Teamplace-Finnegans.md
```

## Desarrollo sin Docker (opcional)

Necesitás un Postgres local accesible en la `DATABASE_URL` del `.env`.

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev            # http://localhost:3000 (Turbopack)
```
