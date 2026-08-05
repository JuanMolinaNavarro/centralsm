"use client";

import { useState } from "react";
import { Boxes, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductosTable, type ProductoResumen } from "@/components/teamplace/productos-table";
import { StockExplorer } from "@/components/teamplace/stock-explorer";

type Tab = "productos" | "stock";

export function TeamplaceExplorer({ productos }: { productos: ProductoResumen[] }) {
  const [tab, setTab] = useState<Tab>("productos");

  return (
    <div className="flex flex-col gap-6">
      <div className="inline-flex w-fit gap-1 rounded-lg border bg-muted/40 p-1">
        <TabButton active={tab === "productos"} onClick={() => setTab("productos")}>
          <Package className="size-4" /> Productos
        </TabButton>
        <TabButton active={tab === "stock"} onClick={() => setTab("stock")}>
          <Boxes className="size-4" /> Stock
        </TabButton>
      </div>

      {tab === "productos" ? <ProductosTable productos={productos} /> : <StockExplorer />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
