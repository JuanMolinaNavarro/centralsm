import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verificarSesionToken } from "@/lib/auth";

// Autenticación global: todo requiere sesión salvo /login y /api/health.
// (En esta versión de Next el viejo middleware.ts se llama proxy.ts.)

const PUBLICAS = ["/login", "/api/health"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verificarSesionToken(token)) return NextResponse.next();

  // APIs: 401 en JSON. Páginas: redirect al login con retorno.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Excluye assets estáticos; el resto pasa por auth.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|map|txt|woff2?)$).*)",
  ],
};
