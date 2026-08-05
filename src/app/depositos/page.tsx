import { getDepositos } from "@/lib/depositos";
import { DepositosTable } from "@/components/depositos/depositos-table";

export const dynamic = "force-dynamic";

export default async function DepositosPage() {
  const depositos = await getDepositos();
  const conStock = depositos.filter((d) => d.productos > 0).length;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Depósitos</h1>
        <p className="text-sm text-muted-foreground">
          {depositos.length} depósitos ({conStock} con stock). El inventario sale del último
          snapshot de Teamplace — consultarlo es gratis.
        </p>
      </div>
      <DepositosTable depositos={depositos} />
    </main>
  );
}
