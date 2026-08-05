import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Crumb } from "@/lib/catalogo";

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <Link href="/catalogo" className="hover:text-foreground">
        Catálogo
      </Link>
      {items.map((c, i) => (
        <span key={c.id} className="flex items-center gap-1">
          <ChevronRight className="size-3.5" />
          {i === items.length - 1 ? (
            <span className="font-medium text-foreground">{c.nombre}</span>
          ) : (
            <Link href={`/catalogo/${c.id}`} className="hover:text-foreground">
              {c.nombre}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
