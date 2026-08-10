"use client";

import { useRouter } from "next/navigation";
import { History } from "lucide-react";

export type RunOption = { id: string; etiqueta: string };

/**
 * Selector de corridas de sincronización: permite ver el dashboard tal como
 * quedó después de cualquier corrida anterior (?run=<id>).
 */
export function RunSelector({ runs, actual }: { runs: RunOption[]; actual?: string }) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <History className="size-4" />
      <span className="hidden sm:inline">Ver fecha</span>
      <select
        value={actual ?? ""}
        onChange={(e) =>
          router.push(e.target.value ? `/dashboard?run=${e.target.value}` : "/dashboard")
        }
        className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        <option value="">Actual (última corrida)</option>
        {runs.map((r) => (
          <option key={r.id} value={r.id}>
            {r.etiqueta}
          </option>
        ))}
      </select>
    </label>
  );
}
