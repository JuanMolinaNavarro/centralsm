// Formateo de fechas SIEMPRE en hora de Argentina. El server corre en UTC
// (contenedor), así que hay que fijar la timeZone explícitamente o se muestra
// en UTC.
const TZ = "America/Argentina/Buenos_Aires";

/** dd/mm/aa hh:mm en hora Argentina. */
export function fechaHoraAR(d: Date): string {
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: TZ });
}

/** Fecha larga + hora en hora Argentina. */
export function fechaHoraLargaAR(d: Date): string {
  return d.toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short", timeZone: TZ });
}
