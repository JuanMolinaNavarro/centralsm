"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Home, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  const pathname = usePathname();
  // El dashboard tiene su propio shell (sidebar), así que ahí ocultamos el header.
  if (pathname?.startsWith("/dashboard")) return null;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight"
        >
          <Boxes className="size-5 text-primary" />
          CentralSM
        </Link>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" render={<Link href="/dashboard" />} nativeButton={false}>
            <LayoutDashboard className="size-4" /> Dashboard
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/catalogo" />} nativeButton={false}>
            Catálogo
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/depositos" />} nativeButton={false}>
            Depósitos
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/" />} nativeButton={false}>
            <Home className="size-4" /> Inicio
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
