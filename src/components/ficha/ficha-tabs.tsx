"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Las tres capas del artículo: la 1 se completa una vez y casi no cambia, la 2
 * crece sola con la operación, la 3 no se escribe nunca — se recalcula con
 * cada cambio de las otras dos.
 */
export function FichaTabs({
  articulo,
  movimientos,
  derivado,
}: {
  articulo: React.ReactNode;
  movimientos: React.ReactNode;
  derivado: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="articulo" className="mt-6">
      <TabsList>
        <TabsTrigger value="articulo" className="px-3">
          <span className="font-mono text-xs opacity-60">1</span> Artículo
        </TabsTrigger>
        <TabsTrigger value="movimientos" className="px-3">
          <span className="font-mono text-xs opacity-60">2</span> Movimientos
        </TabsTrigger>
        <TabsTrigger value="derivado" className="px-3">
          <span className="font-mono text-xs opacity-60">3</span> Derivado
        </TabsTrigger>
      </TabsList>
      <TabsContent value="articulo">{articulo}</TabsContent>
      <TabsContent value="movimientos">{movimientos}</TabsContent>
      <TabsContent value="derivado">{derivado}</TabsContent>
    </Tabs>
  );
}
