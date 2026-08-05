"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Cambiar entre modo claro y oscuro"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {/* Antes de montar, render neutro para evitar mismatch de hidratación. */}
      {mounted ? isDark ? <Sun className="size-4" /> : <Moon className="size-4" /> : <Sun className="size-4 opacity-0" />}
    </Button>
  );
}
