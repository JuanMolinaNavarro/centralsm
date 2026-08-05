"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { crearSesionToken, verificarPassword, SESSION_COOKIE, SESSION_DIAS } from "@/lib/auth";

export async function login(_prev: { error?: string } | null, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!(await verificarPassword(password))) {
    return { error: "Contraseña incorrecta" };
  }

  (await cookies()).set(SESSION_COOKIE, await crearSesionToken(), {
    httpOnly: true,
    sameSite: "lax",
    // secure: false a propósito — la app se sirve por HTTP en la LAN.
    // Si algún día va detrás de TLS, poner secure: true.
    path: "/",
    maxAge: SESSION_DIAS * 24 * 60 * 60,
  });

  // Solo rutas internas (evita open redirect).
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
