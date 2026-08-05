# syntax=docker/dockerfile:1

# ---- Base ----------------------------------------------------------------
FROM node:22-slim AS base
WORKDIR /app
# openssl para los engines de Prisma; tzdata para la zona horaria del cron.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/*

# ---- Dependencias --------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
# Se usa "npm install" (no "npm ci") porque el lockfile se genera en Windows y
# no registra las dependencias opcionales solo-Linux (@emnapi, lightningcss-linux,
# etc.); npm install las resuelve dentro del contenedor.
# --ignore-scripts evita correr "prisma generate" antes de copiar el schema.
#
# La cache de npm se monta como cache de BuildKit: si el install se corta a la
# mitad (ECONNRESET), el reintento reaprovecha lo ya bajado en vez de empezar
# de cero. Los reintentos/timeouts largos toleran redes inestables.
RUN --mount=type=cache,target=/root/.npm \
  npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 600000 \
  && npm install --ignore-scripts --no-audit --no-fund

# ---- Desarrollo (hot reload) --------------------------------------------
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules

# Chromium para el bot que da de alta productos en Finnegans Go
# (docs/alta-productos-centralsm.md). Solo lo necesita el servicio "worker", que
# lo activa con build.args; app y cron lo dejan en false para no cargar ~400 MB
# de más. (La imagen autocontenida del worker es Dockerfile.worker.)
ARG INSTALL_PLAYWRIGHT=false
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN if [ "$INSTALL_PLAYWRIGHT" = "true" ]; then \
      npx playwright install --with-deps chromium; \
    else \
      echo "Playwright omitido (INSTALL_PLAYWRIGHT=false)"; \
    fi

COPY . .
EXPOSE 3000
# El código real se monta por volumen; el comando lo define docker-compose.
CMD ["npm", "run", "dev:docker"]

# ---- Build de producción -------------------------------------------------
FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---- Producción (imagen mínima, standalone) -----------------------------
FROM base AS production
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs
# El volumen de uploads hereda el owner de este dir en el primer montaje;
# sin esto queda root y la app (usuario nextjs) no puede escribir imágenes.
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
