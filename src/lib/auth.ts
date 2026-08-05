// Sesión mínima por cookie firmada (HMAC-SHA256, Web Crypto: corre igual en
// proxy.ts y en server actions). Una sola password compartida (AUTH_PASSWORD)
// y un secreto de firma (AUTH_SECRET), ambos en .env.
//
// Formato del token: "<expMs>.<firmaBase64url>" — la firma cubre el vencimiento,
// así un token robado no puede extenderse.

export const SESSION_COOKIE = "csm_session";
export const SESSION_DIAS = 30;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta AUTH_SECRET en el entorno");
  return s;
}

async function firmar(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Buffer.from(sig).toString("base64url");
}

export async function crearSesionToken(): Promise<string> {
  const exp = Date.now() + SESSION_DIAS * 24 * 60 * 60 * 1000;
  return `${exp}.${await firmar(`csm|${exp}`)}`;
}

export async function verificarSesionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || Date.now() > exp) return false;
  const esperada = await firmar(`csm|${exp}`);
  // Comparación de largo fijo (ambas son firmas base64url de 32 bytes).
  if (sig.length !== esperada.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ esperada.charCodeAt(i);
  return diff === 0;
}

/** Compara la password ingresada contra AUTH_PASSWORD sin filtrar timing/largo. */
export async function verificarPassword(ingresada: string): Promise<boolean> {
  const real = process.env.AUTH_PASSWORD;
  if (!real) return false;
  const [a, b] = await Promise.all([firmar(`pw|${ingresada}`), firmar(`pw|${real}`)]);
  return a === b;
}
