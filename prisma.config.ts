// Carga las variables de .env (Prisma 7 no las lee automáticamente).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // URL usada por Prisma Migrate / CLI. El cliente en runtime usa el adapter
  // (@prisma/adapter-pg) configurado en src/lib/prisma.ts.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
