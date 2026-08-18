import Link from "next/link";

const TABS = [
  { href: "/catalogo", label: "Categorías", key: "categorias" },
  { href: "/catalogo/clasificar", label: "Clasificar", key: "clasificar" },
  { href: "/catalogo/altas", label: "Altas Finnegans", key: "altas" },
] as const;

export type CatalogoTab = (typeof TABS)[number]["key"];

/** Navegación entre las vistas del módulo Catálogo (árbol de categorías, clasificador manual y altas con push a Finnegans). */
export function CatalogoTabs({ activa }: { activa: CatalogoTab }) {
  return (
    <div className="flex w-fit gap-1 rounded-lg border bg-muted/40 p-1">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            t.key === activa
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
