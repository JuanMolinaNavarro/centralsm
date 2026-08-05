import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 requiere un driver adapter para conexiones directas a la base.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Singleton de PrismaClient. En desarrollo, Next.js recarga los módulos en cada
// cambio (HMR), lo que crearía muchas conexiones; lo guardamos en globalThis
// para reutilizar la misma instancia.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
