// Taxonomía ISP del catálogo + clasificador heurístico por palabras clave.
// Se usa para el import/sync desde Teamplace (ver scripts/teamplace-sync.ts).
// Es un primer pase automático: los que no matchean van a la rama "REV" (Revisar).

export type Familia = { frag: string; nombre: string };
export type Macro = { frag: string; nombre: string; descripcion?: string; familias: Familia[] };

// Árbol de categorías tangibles + rama REV. (No incluye los "No Inventariable".)
export const TAXONOMIA: Macro[] = [
  {
    frag: "FO",
    nombre: "Fibra y Planta Externa",
    descripcion: "Cables ópticos, conectividad, cierres/distribución y herrajes de la red de fibra.",
    familias: [
      { frag: "CAB", nombre: "Cables de fibra" },
      { frag: "CNX", nombre: "Conectividad óptica" },
      { frag: "DIS", nombre: "Cierres y distribución" },
      { frag: "HER", nombre: "Herrajes y sujeción" },
    ],
  },
  {
    frag: "RED",
    nombre: "Equipos de Red Activos",
    descripcion: "Equipamiento activo: OLT, switches, óptica activa, wireless y cableado estructurado.",
    familias: [
      { frag: "OLT", nombre: "OLT / EPON / GPON" },
      { frag: "SW", nombre: "Switches / Routers" },
      { frag: "TRX", nombre: "Óptica activa / Transporte" },
      { frag: "WIFI", nombre: "Wireless / Antenas" },
      { frag: "UTP", nombre: "Cableado estructurado (UTP)" },
    ],
  },
  {
    frag: "TV",
    nombre: "Headend y CATV/TV",
    descripcion: "Cabecera y distribución de señal de TV/CATV.",
    familias: [
      { frag: "MOD", nombre: "Moduladores / Encoders" },
      { frag: "RF", nombre: "RF / Coaxial" },
      { frag: "RX", nombre: "Receptores / Satelital" },
    ],
  },
  {
    frag: "CPE",
    nombre: "Equipamiento del Abonado",
    descripcion: "Equipos instalados en el domicilio del cliente.",
    familias: [
      { frag: "MODEM", nombre: "Módems / Routers WiFi" },
      { frag: "STB", nombre: "Set-Top-Box / IPTV" },
    ],
  },
  {
    frag: "SEG",
    nombre: "Seguridad y Videovigilancia",
    descripcion: "Cámaras, grabadores y alarmas.",
    familias: [
      { frag: "CAM", nombre: "Cámaras" },
      { frag: "NVR", nombre: "Grabadores" },
      { frag: "ALA", nombre: "Alarmas y sensores" },
    ],
  },
  {
    frag: "ENE",
    nombre: "Energía",
    descripcion: "Alimentación, respaldo, protección eléctrica y climatización.",
    familias: [
      { frag: "FTE", nombre: "Fuentes / Cargadores" },
      { frag: "RACK", nombre: "Racks / Gabinetes" },
      { frag: "UPS", nombre: "UPS / Baterías" },
      { frag: "ELE", nombre: "Protección eléctrica" },
      { frag: "CLIMA", nombre: "Climatización" },
    ],
  },
  {
    frag: "TI",
    nombre: "Cómputo y TI",
    descripcion: "Servidores, almacenamiento y equipos informáticos.",
    familias: [
      { frag: "ALM", nombre: "Discos / Memorias / Tarjetas" },
      { frag: "PC", nombre: "PC / Notebooks / Monitores" },
      { frag: "SRV", nombre: "Servidores / Storage" },
    ],
  },
  {
    frag: "HER",
    nombre: "Herramientas e Instrumental",
    descripcion: "Herramientas, instrumental de fibra y seguridad laboral.",
    familias: [
      { frag: "TOOL", nombre: "Herramientas" },
      { frag: "INS", nombre: "Instrumental de fibra" },
      { frag: "EPP", nombre: "Seguridad laboral (EPP)" },
    ],
  },
  {
    frag: "INS",
    nombre: "Insumos y Ferretería",
    descripcion: "Sujeción, cintas, adhesivos y consumibles.",
    familias: [
      { frag: "FIJ", nombre: "Sujeción y fijación" },
      { frag: "CIN", nombre: "Cintas y adhesivos" },
      { frag: "CONS", nombre: "Consumibles varios" },
    ],
  },
  {
    frag: "REV",
    nombre: "Revisar (sin clasificar)",
    descripcion: "Artículos que el clasificador automático no pudo asignar. Revisar y recategorizar.",
    familias: [],
  },
];

export type Tipo = "TANGIBLE" | "NIN" | "TEST" | "REV";
export type Clasif = { tipo: Tipo; macroFrag?: string; famFrag?: string };

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const has = (t: string, kws: string[]) =>
  kws.some((k) => new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`).test(t));

// Reglas ordenadas: primer match gana. tipo: NIN/TEST se excluyen del catálogo.
const RULES: { tipo: Tipo; macro: string; fam: string; kws: string[] }[] = [
  { tipo: "NIN", macro: "NIN", fam: "LOC", kws: ["plaza", "megas", "atm cpa", "cpa atm", "proyecto"] },
  { tipo: "NIN", macro: "NIN", fam: "CON", kws: ["internet", "mbps", "simetrico", "asimetrico", "dedicado", "conectividad", "vinculo", "banda", "provision", "conexion", "ip publica", "ip fija"] },
  { tipo: "NIN", macro: "NIN", fam: "MO", kws: ["mano de obra", "guardia", "despliegue", "instalacion", "tecnica", "ingenieria", "operacion", "call center", "mantenimiento", "contratista", "obra"] },
  { tipo: "NIN", macro: "NIN", fam: "FIN", kws: ["iva", "iva0", "iva21", "impuesto", "impuestos", "diferencia", "ajuste", "redondeo", "interes", "descuento", "comision", "percepcion", "arancel", "derechos", "despacho", "importaciones", "estadistica", "cuit", "combustible", "gasto", "gastos", "bonificacion", "pagar", "viaticos", "sueldos", "art", "suss", "tarjeta", "flete", "cadeteria", "seña", "sena", "anticipo"] },
  { tipo: "NIN", macro: "NIN", fam: "SVC", kws: ["alquiler", "arrendamiento", "alojamiento", "locacion", "certificacion", "licencia", "garantia", "honorarios", "abono", "cuota", "suscripcion", "hormigon", "cemento", "pavim", "data center", "911"] },
  { tipo: "TEST", macro: "ZZ", fam: "TEST", kws: ["ejemplo", "demo", "prueba controla", "prueba no controla"] },

  { tipo: "TANGIBLE", macro: "RED", fam: "UTP", kws: ["utp", "cat5", "cat-5", "cat6", "cat-6", "rj45", "rj-45", "par trenzado", "pares", "ftp", "stp"] },

  { tipo: "TANGIBLE", macro: "FO", fam: "CAB", kws: ["fibra", "adss", "drop", "pelos", "pelo", "hilos", "dielectrica", "armada", "figura 8", "mensajero"] },
  { tipo: "TANGIBLE", macro: "FO", fam: "CNX", kws: ["patchcord", "pigtail", "conector", "conectores", "spliter", "splitter", "divisor", "atenuador", "atenuadores", "acoplador", "fast sc", "sc/apc", "lc/upc", "adaptador optico"] },
  { tipo: "TANGIBLE", macro: "FO", fam: "DIS", kws: ["nap", "odf", "manga", "mufa", "roseta", "bandeja", "botella", "domo empalme", "organizador", "cierre", "distribuidor optico", "dio", "panel", "patch panel", "patch-panel"] },
  { tipo: "TANGIBLE", macro: "FO", fam: "HER", kws: ["preformado", "pref", "morseto", "morseteria", "suspension", "herraje", "abrazadera", "retencion", "cruz", "separador", "tensor", "fleje", "zuncho", "poste", "columna", "cruceta", "mensula", "soporte", "acero", "hierro", "chapa", "galvanizado", "galv", "bracket"] },

  { tipo: "TANGIBLE", macro: "TV", fam: "MOD", kws: ["modulador", "encoder", "canal", "transcodificador"] },
  { tipo: "TANGIBLE", macro: "TV", fam: "RX", kws: ["receptor", "lnb", "satelital", "irt", "dvb", "quam", "sumador", "combinador"] },
  { tipo: "TANGIBLE", macro: "TV", fam: "RF", kws: ["coaxial", "coaxil", "rg6", "rg-6", "rg59", "rg-59", "rg11", "rg-11", "carga f", "amplificador", "tap", "derivador", "paso", "spliteo", "atenuador rf", "conector compresion"] },

  { tipo: "TANGIBLE", macro: "RED", fam: "OLT", kws: ["olt", "epon", "gpon", "onu", "ont", "pon"] },
  { tipo: "TANGIBLE", macro: "RED", fam: "SW", kws: ["switch", "router", "mikrotik", "cisco", "ruteo", "routerboard", "cmts", "board"] },
  { tipo: "TANGIBLE", macro: "RED", fam: "TRX", kws: ["edfa", "transceiver", "sfp", "media converter", "conversor", "converter", "transponder"] },
  { tipo: "TANGIBLE", macro: "RED", fam: "WIFI", kws: ["access point", "acces point", "antena", "wireless", "ubiquiti", "poe", "cpe", "airmax", "lite"] },

  { tipo: "TANGIBLE", macro: "CPE", fam: "MODEM", kws: ["modem", "wifi", "mesh", "repetidor", "extensor", "eap", "deco", "decodificador"] },
  { tipo: "TANGIBLE", macro: "CPE", fam: "STB", kws: ["set top box", "stb", "iptv"] },

  { tipo: "TANGIBLE", macro: "SEG", fam: "CAM", kws: ["camara", "camaras", "ipc", "bullet", "domo", "cam", "imou", "dahua", "hikvision", "ptz"] },
  { tipo: "TANGIBLE", macro: "SEG", fam: "NVR", kws: ["nvr", "dvr", "xvr", "grabador"] },
  { tipo: "TANGIBLE", macro: "SEG", fam: "ALA", kws: ["alarma", "alarmas", "sensor", "sensores", "sirena", "estacion alarma"] },

  { tipo: "TANGIBLE", macro: "ENE", fam: "FTE", kws: ["fuente", "cargador", "adaptador", "12v", "24v", "48v", "5v", "transformador"] },
  { tipo: "TANGIBLE", macro: "ENE", fam: "UPS", kws: ["ups", "bateria", "baterias", "rectificador", "inversor", "estabilizador", "pila", "pilas"] },
  { tipo: "TANGIBLE", macro: "ENE", fam: "RACK", kws: ["rack", "gabinete", "organiz", "bandeja rack"] },
  { tipo: "TANGIBLE", macro: "ENE", fam: "ELE", kws: ["termica", "disyuntor", "interruptor", "bipolar", "toma", "zapatilla", "prolongador", "regleta", "llave termica", "unipolar"] },
  { tipo: "TANGIBLE", macro: "ENE", fam: "CLIMA", kws: ["aire", "acondicionado", "split", "ventilacion", "climatiz"] },

  { tipo: "TANGIBLE", macro: "TI", fam: "SRV", kws: ["servidor", "server", "storage", "nas", "san"] },
  { tipo: "TANGIBLE", macro: "TI", fam: "ALM", kws: ["disco", "ssd", "hdd", "memoria", "micro-sd", "tarjeta", "sd"] },
  { tipo: "TANGIBLE", macro: "TI", fam: "PC", kws: ["notebook", "monitor", "teclado", "mouse", "cpu", "impresora", "toner"] },

  { tipo: "TANGIBLE", macro: "HER", fam: "INS", kws: ["fusionadora", "otdr", "power meter", "medidor", "cleaver", "cortadora", "identificador", "microscopio", "vfl", "laser"] },
  { tipo: "TANGIBLE", macro: "HER", fam: "TOOL", kws: ["herramienta", "herramientas", "llave", "mecha", "pinza", "taladro", "destornillador", "destor", "martillo", "sierra", "amoladora", "crimp", "ponchadora", "pelacables", "tester", "multimetro", "escalera", "pistola", "punta prueba", "punta de prueba"] },
  { tipo: "TANGIBLE", macro: "HER", fam: "EPP", kws: ["arnes", "casco", "guante", "guantes", "cinturon", "eslinga", "epp", "chaleco"] },

  { tipo: "TANGIBLE", macro: "INS", fam: "FIJ", kws: ["precinto", "precintos", "grampa", "grampas", "taco", "tacos", "tornillo", "tornillos", "tuerca", "arandela", "bulon", "tarugo", "clavo", "brida", "bridas"] },
  { tipo: "TANGIBLE", macro: "INS", fam: "CIN", kws: ["cinta", "adhesivo", "silicona", "termocontraible", "spiralado", "espiralado", "aisladora"] },
  { tipo: "TANGIBLE", macro: "INS", fam: "CONS", kws: ["alcohol", "limpiador", "isopropilico", "etiqueta", "etiquetas", "pvc", "plast", "nylon", "soga", "piola", "buje"] },
];

/** Clasifica un producto por nombre/código. Devuelve el destino en la taxonomía. */
export function clasificar(nombre: string, codigo: string): Clasif {
  const c = norm(codigo);
  if (/^zprueb/.test(c)) return { tipo: "TEST" };
  const t = norm(nombre);
  for (const r of RULES) {
    if (has(t, r.kws)) {
      return { tipo: r.tipo, macroFrag: r.macro, famFrag: r.fam };
    }
  }
  return { tipo: "REV" };
}
