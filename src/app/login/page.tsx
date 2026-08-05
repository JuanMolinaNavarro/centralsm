"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  const next = useSearchParams().get("next") ?? "/";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>CentralSM</CardTitle>
        <CardDescription>Ingresá la contraseña de acceso.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" autoFocus required />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Verificando…" : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
