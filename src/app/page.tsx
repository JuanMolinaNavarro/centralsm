import Link from "next/link";
import { LayoutDashboard, Package, PackagePlus, Warehouse, ArrowLeftRight, Cloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const modulos = [
  {
    titulo: "Dashboard",
    descripcion: "Resumen de la última sincronización y cambios de stock.",
    icono: LayoutDashboard,
    href: "/dashboard",
  },
  {
    titulo: "Catálogo",
    descripcion: "Categorías, subcategorías y artículos con SKU por capas.",
    icono: Package,
    href: "/catalogo",
  },
  {
    titulo: "Depósitos",
    descripcion: "Existencias actuales por producto y depósito.",
    icono: Warehouse,
    href: "/depositos",
  },
  {
    titulo: "Movimientos",
    descripcion: "Histórico de entradas y salidas detectadas por el sync.",
    icono: ArrowLeftRight,
    href: "/dashboard/movimientos",
  },
  {
    titulo: "Productos",
    descripcion: "Altas locales y su carga automática en Finnegans Go.",
    icono: PackagePlus,
    href: "/productos",
  },
  {
    titulo: "Teamplace",
    descripcion: "Explorar productos y stock desde la API de Finnegans.",
    icono: Cloud,
    href: "/teamplace",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center bg-muted/30 px-6 py-16">
      <div className="w-full max-w-5xl">
        <div className="mb-10 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">CentralSM</h1>
            <Badge variant="secondary">v0.1.0</Badge>
          </div>
          <p className="max-w-2xl text-muted-foreground">
            Plataforma de centralización de stock management y actividades de la
            empresa, integrada con Teamplace / Finnegans.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modulos.map(({ titulo, descripcion, icono: Icono, href }) => (
            <Card key={titulo} className="flex flex-col">
              <CardHeader>
                <Icono className="size-6 text-primary" />
                <CardTitle className="mt-2">{titulo}</CardTitle>
                <CardDescription>{descripcion}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button
                  render={<Link href={href} />}
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Abrir
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
