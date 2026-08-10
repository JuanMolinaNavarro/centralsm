"use client";

// Pestaña 3 · Derivado — no se escribe nunca: se recalcula con cada cambio de
// las otras dos pestañas (el cálculo corre en el server, src/lib/ficha.ts).

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FichaData } from "@/lib/ficha-data";
import {
  EXPLICACION_PATRON,
  MESES_VENTANA,
  POLITICA,
  UMBRAL_ADI,
  UMBRAL_CV2,
  UMBRAL_KIT,
  Z_SERVICIO,
  DIAS_VENTANA,
  type Patron,
} from "@/lib/ficha";
import { nf } from "./constantes";
import { CuadrantePatrones } from "./graficos";
import { InfoDialog, InfoFila, InfoItem } from "./info-dialog";

const COLOR_PATRON: Record<Patron, string> = {
  Suave: "text-emerald-600 dark:text-emerald-400 border-emerald-600/50",
  Errática: "text-orange-600 dark:text-orange-400 border-orange-600/50",
  Intermitente: "text-primary border-primary/50",
  Grumosa: "text-red-600 dark:text-red-400 border-red-600/50",
  "Sin movimiento": "text-muted-foreground border-border",
};

function Bloque({
  titulo,
  info,
  bloqueado,
  children,
}: {
  titulo: string;
  info?: React.ReactNode;
  bloqueado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={bloqueado ? "opacity-80" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-1 text-center text-sm uppercase tracking-widest text-muted-foreground">
          {titulo}
          {info}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">{children}</CardContent>
    </Card>
  );
}

function Proposito({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] leading-relaxed text-muted-foreground">{children}</div>;
}

function Resultado({
  valor,
  unidad,
  destacado,
  interp,
}: {
  valor: string;
  unidad?: string;
  destacado?: boolean;
  interp?: React.ReactNode;
}) {
  return (
    <div>
      <div
        className={
          destacado
            ? "inline-flex items-baseline gap-2 rounded-lg bg-primary/10 px-3 py-1"
            : "flex items-baseline gap-2"
        }
      >
        <span className={`font-mono font-semibold tabular-nums ${destacado ? "text-2xl text-primary" : "text-base"}`}>
          {valor}
        </span>
        {unidad && <span className="font-mono text-xs text-muted-foreground">{unidad}</span>}
      </div>
      {interp && <p className="mt-1 text-xs text-muted-foreground">{interp}</p>}
    </div>
  );
}

function FaltaDato({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t border-dashed pt-2 text-xs leading-relaxed text-orange-700 dark:text-orange-400">
      {children}
    </p>
  );
}

export function DerivadoPanel({ data }: { data: FichaData }) {
  const c = data.calculo;
  const p = data.producto;
  const pol = POLITICA[c.patron];
  const puedeFormula = c.patron === "Suave" && data.ltMedio !== null;
  const faltaCosto = data.costo === null;
  const fmtAdi = c.adi !== null ? c.adi.toFixed(1).replace(".", ",") : "—";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* 1 · Cómo estoy hoy */}
      <Bloque
        titulo="1 · Cómo estoy hoy"
        info={
          <InfoDialog
            titulo="Cómo estoy hoy · cómo leerlo"
            intro="Los dos números que traducen toda la serie a lenguaje de depósito: a qué ritmo sale y cuántos días aguanta lo que hay."
          >
            <InfoItem titulo="Consumo diario">
              <InfoFila etiqueta="¿Qué es?">
                Todo lo consumido en 2 años dividido por 730 días. Incluye los meses en cero a propósito: es
                el ritmo promedio real, no el de los meses buenos.
              </InfoFila>
              <InfoFila etiqueta="Ojo con" tono="rojo">
                Es un promedio, no un pronóstico: no ve estacionalidad ni crecimiento. Para un artículo que
                viene creciendo, subestima el ritmo actual.
              </InfoFila>
            </InfoItem>
            <InfoItem titulo="Cobertura">
              <InfoFila etiqueta="¿Qué es?">
                Stock actual ÷ consumo diario = cuántos días aguanta el stock de hoy si se sigue consumiendo
                al ritmo promedio.
              </InfoFila>
              <InfoFila etiqueta="La lectura clave" tono="verde">
                Compararla contra el lead time del proveedor. Si la cobertura es menor que el lead time, ya
                estás tarde: el stock se acaba antes de que llegue lo que pidas hoy.
              </InfoFila>
            </InfoItem>
          </InfoDialog>
        }
      >
        <Proposito>
          La foto del artículo en este momento: a qué ritmo sale y cuánto aguanta lo que hay en el depósito.
        </Proposito>
        <div className="font-medium">El stock de hoy alcanza para</div>
        <Resultado
          valor={c.coberturaDias !== null ? nf(c.coberturaDias, 1) : "—"}
          unidad="días"
          destacado
          interp={
            c.coberturaDias !== null && data.ltMedio
              ? c.coberturaDias < data.ltMedio
                ? <b className="text-red-600 dark:text-red-400">menos que el lead time ({data.ltMedio} d): ya estás tarde, hay que comprar</b>
                : `más que el lead time (${data.ltMedio} d): hay margen para reponer a tiempo`
              : "cargará al tener consumo y lead time"
          }
        />
        <Formula>
          cálculo: cobertura = stock actual ÷ consumo diario = {nf(p.stock)} ÷ {nf(c.consumoDiario, 1)}
        </Formula>
        <div className="mt-1 font-medium">Sale del depósito a un ritmo de</div>
        <Resultado
          valor={nf(c.consumoDiario, 1)}
          unidad={`${p.unidadBase}/día`}
          destacado
          interp="promedio real de los 2 años, contando también los meses en cero"
        />
        <Formula>cálculo: consumo diario = {nf(c.total)} ÷ {DIAS_VENTANA} días</Formula>
      </Bloque>

      {/* 2 · Qué comprar */}
      <Bloque
        titulo="2 · Qué comprar"
        bloqueado={!puedeFormula}
        info={
          <InfoDialog
            titulo="Qué comprar · la cadena completa"
            intro="Cuatro pasos encadenados que terminan en una orden que compras puede emitir tal cual. Solo corre con patrón Suave."
          >
            <InfoItem titulo="Stock de seguridad (ss)">
              <InfoFila etiqueta="¿Qué es?">
                Un colchón contra los dos imprevistos posibles: que la demanda suba más de lo normal, o que el
                proveedor tarde más de lo normal. La fórmula combina las dos incertidumbres — por eso hace
                falta el desvío del lead time, no solo el promedio.
              </InfoFila>
              <InfoFila etiqueta={`¿Qué es Z = ${Z_SERVICIO}?`} tono="verde">
                El nivel de servicio elegido: 95%. De cada 100 esperas de reposición, en 95 el colchón alcanza
                y no hay quiebre. Subir a 99% agranda el colchón (y la plata inmovilizada).
              </InfoFila>
            </InfoItem>
            <InfoItem titulo="Punto de pedido">
              <InfoFila etiqueta="¿Qué es?">
                La alarma: lo que se va a consumir mientras el pedido viaja (consumo diario × lead time) más el colchón.
              </InfoFila>
              <InfoFila etiqueta="La lectura" tono="verde">
                Cuando el stock toca este número, hay que emitir la orden. Ni antes (plata dormida) ni después (quiebre).
              </InfoFila>
            </InfoItem>
            <InfoItem titulo="Necesidad">
              <InfoFila etiqueta="¿Qué es?">
                Lo que falta para volver al punto de pedido, descontando el stock que hay y lo que ya está en
                tránsito — para no comprar dos veces lo mismo.
              </InfoFila>
            </InfoItem>
            <InfoItem titulo="q · la sugerencia final">
              <InfoFila etiqueta="¿Qué es?">
                La necesidad traducida a lo que el proveedor acepta vender: redondeada al múltiplo y nunca
                menos que el lote mínimo (los cargados en Medida).
              </InfoFila>
              <InfoFila etiqueta="¿Para qué sirve?" tono="verde">
                Para que el resultado no sea «comprá 743 unidades» sino «comprá 8 cajas»: un número ejecutable
                sin traducción manual.
              </InfoFila>
            </InfoItem>
            <InfoItem titulo="¿Y si el patrón no es Suave?">
              <InfoFila etiqueta="El bloqueo" tono="rojo">
                Este bloque se apaga solo. Para demanda errática, intermitente o grumosa la política es
                mínimo-máximo (compras define un piso y un techo) o compra contra pedido.
              </InfoFila>
            </InfoItem>
          </InfoDialog>
        }
      >
        <Proposito>
          La sugerencia de compra, ya traducida a lo que el proveedor acepta vender. Solo se calcula sola con
          política de fórmula automática.
        </Proposito>
        <div className="font-medium">Emitir la orden cuando el stock baje a</div>
        <Resultado
          valor={c.puntoPedido !== null ? nf(c.puntoPedido) : "—"}
          unidad={p.unidadBase}
          destacado={c.puntoPedido !== null}
          interp="es la alarma: cubre lo que se consume mientras el pedido viaja, más el colchón"
        />
        <Formula>
          cálculo: punto de pedido = consumo diario × LT + ss
          {c.puntoPedido !== null && ` = ${nf(c.consumoDiario, 1)} × ${data.ltMedio} + ${nf(c.stockSeguridad)}`}
        </Formula>
        <div className="mt-1 font-medium">Cantidad a pedir</div>
        <Resultado
          valor={
            c.sugerenciaQ !== null
              ? nf(c.sugerenciaQ)
              : c.necesidad !== null && c.necesidad <= 0
                ? "0"
                : "—"
          }
          unidad={p.unidadBase}
          destacado={c.sugerenciaQ !== null}
          interp={
            c.sugerenciaQ !== null && data.seleccionado?.factorCompra ? (
              <>
                equivale a <b>{nf(c.sugerenciaQ / data.seleccionado.factorCompra, 1)} {data.seleccionado.unidadCompra}</b>{" "}
                del proveedor seleccionado
              </>
            ) : c.necesidad !== null && c.necesidad <= 0 ? (
              "con el stock y lo en tránsito alcanza: no hay que comprar"
            ) : (
              "redondeada al lote mínimo y múltiplo del proveedor"
            )
          }
        />
        <Formula>
          cálculo: q = máx( lote mínimo {nf(data.seleccionado?.loteMinimo ?? null)} , ⌈necesidad ÷ múltiplo{" "}
          {nf(data.seleccionado?.multiplo ?? null)}⌉ × múltiplo )
        </Formula>
        <Formula>
          colchón de seguridad (ss) = {c.stockSeguridad !== null ? `${nf(c.stockSeguridad)} ${p.unidadBase}` : "—"} ·
          protege contra que la demanda suba o que el proveedor tarde · LT {data.ltMedio ?? "—"} d, desvío{" "}
          {data.ltDesvio ?? "—"} d, servicio 95%
        </Formula>
        <Formula>
          necesidad = punto de pedido − stock − en tránsito ={" "}
          {c.necesidad !== null
            ? `${nf(c.puntoPedido)} − ${nf(p.stock)} − ${nf(p.enTransito)} = ${nf(c.necesidad)}`
            : "—"}
        </Formula>
        {!puedeFormula && (
          <FaltaDato>
            {c.patron !== "Suave" ? (
              <>
                Este artículo no se compra por fórmula: su política es <b>{pol.nombre}</b>. El mínimo y el
                máximo los define compras — ver el bloque 3.
              </>
            ) : (
              "Falta el historial de lead time en la pestaña Artículo."
            )}
          </FaltaDato>
        )}
      </Bloque>

      {/* 3 · Política de compra */}
      <Bloque
        titulo="3 · Política de compra"
        info={
          <InfoDialog
            titulo="Política de compra · cómo se decide"
            intro="La política no se elige a dedo: sale de la forma que tiene la demanda. Se miran dos cosas —cada cuánto aparece y qué tan parejas son las cantidades— y de ahí cae el método. Esto no toca el ABC: el ABC es plata, y va aparte."
          >
            <InfoItem titulo="n y k · la ventana que se mira">
              <InfoFila etiqueta="¿Qué son?">
                n es cuántos meses miramos hacia atrás: la ventana fija de 2 años (24 meses). k es en cuántos
                de esos meses hubo consumo real.
              </InfoFila>
              <InfoFila etiqueta="¿Por qué importa k?" tono="verde">
                Porque los agujeros cuentan. Dos artículos pueden consumir 1.200 unidades al año: uno saca 100
                por mes (k=24) y otro saca 600 dos veces al año (k=2). El promedio mensual es idéntico, pero
                se compran de maneras totalmente distintas.
              </InfoFila>
            </InfoItem>
            <InfoItem titulo="ADI · ¿cada cuánto aparece?">
              <InfoFila etiqueta="¿Qué es?">
                ADI = n ÷ k: cada cuántos meses, en promedio, aparece demanda. ADI 1,0 = consume todos los
                meses. ADI 2,0 = un mes sí, un mes no.
              </InfoFila>
              <InfoFila etiqueta="El umbral" tono="rojo">
                Hasta {String(UMBRAL_ADI).replace(".", ",")} se considera frecuente. Por encima, la demanda es
                intermitente y el promedio deja de ser confiable.
              </InfoFila>
            </InfoItem>
            <InfoItem titulo="CV² · ¿las cantidades son parejas?">
              <InfoFila etiqueta="¿Qué es?">
                Compara el desvío contra el promedio de los meses activos. Cerca de 0 = todos los meses se
                lleva más o menos lo mismo. Alto = un mes 100, otro 3.000.
              </InfoFila>
              <InfoFila etiqueta="El umbral" tono="rojo">
                Hasta {String(UMBRAL_CV2).replace(".", ",")} se considera parejo. Por encima, los saltos
                dominan y el promedio engaña.
              </InfoFila>
            </InfoItem>
            <InfoItem titulo="El mapa de los cuatro patrones">
              <p className="mb-2 text-sm leading-relaxed">
                <b>Columnas:</b> izquierda = se consume seguido · derecha = salteado (eso mide ADI).{" "}
                <b>Filas:</b> abajo = cantidades parejas · arriba = a saltos (eso mide CV²). El punto es este
                artículo con sus números de hoy.
              </p>
              <CuadrantePatrones adi={c.adi} cv2={c.cv2} hayConsumo={c.mesesActivos > 0} />
              <InfoFila etiqueta="Ningún cuadrante es «malo»" tono="verde">
                La demanda es la que es: un OLT nunca va a tener ADI 1 porque la red no necesita OLTs todos
                los meses. El mapa no dice «mové todo al cuadrante verde»: dice «usá la herramienta correcta
                para el cuadrante donde cada artículo vive».
              </InfoFila>
              <InfoFila etiqueta="Por qué esto protege la sugerencia de compra" tono="rojo">
                Las fórmulas de punto de pedido y stock de seguridad asumen demanda frecuente y pareja
                (Suave). Aplicarlas a otro patrón da números que parecen precisos pero son inventados. Si el
                artículo cae fuera de Suave, el bloque «Qué comprar» se bloquea solo.
              </InfoFila>
            </InfoItem>
          </InfoDialog>
        }
      >
        <div className="font-medium">Este artículo se gestiona por</div>
        <div className={`w-fit rounded-xl border-2 px-4 py-2 text-lg font-bold ${COLOR_PATRON[c.patron]}`}>
          {pol.nombre}
        </div>
        <p className="text-xs text-muted-foreground">{pol.detalle}</p>
        <div className="border-t border-dashed pt-3">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            Por qué esta política
          </div>
          <div className="mb-2 flex items-start gap-3">
            <span className="min-w-11 text-right font-mono text-lg font-semibold text-primary tabular-nums">
              {fmtAdi}
            </span>
            <span className="text-xs leading-relaxed">
              <b>aparece consumo cada {fmtAdi} meses</b> · esto se llama ADI: detecta la demanda que no es
              constante.
              <br />
              <span className="font-mono text-muted-foreground">
                n ÷ k = {MESES_VENTANA} meses mirados ÷ {c.mesesActivos} con consumo
              </span>
            </span>
          </div>
          <div className="mb-2 flex items-start gap-3">
            <span className="min-w-11 text-right font-mono text-lg font-semibold text-primary tabular-nums">
              {c.cv2.toFixed(2).replace(".", ",")}
            </span>
            <span className="text-xs leading-relaxed">
              <b>saltos entre cantidades</b> · esto se llama CV²: cerca de 0 cada mes se lleva lo mismo, alto
              un mes 100 y otro 3.000.
              <br />
              <span className="font-mono text-muted-foreground">
                (desvío ÷ promedio de meses activos)² = ({nf(c.desvio, 1)} ÷ {nf(c.media, 1)})²
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            patrón resultante:
            <Badge variant="outline" className={COLOR_PATRON[c.patron]}>
              {c.patron}
            </Badge>
            <span className="font-mono text-muted-foreground">
              umbrales ADI &lt; {String(UMBRAL_ADI).replace(".", ",")} y CV² &lt;{" "}
              {String(UMBRAL_CV2).replace(".", ",")} → Suave
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {EXPLICACION_PATRON[c.patron]} Ningún patrón es mejor que otro: cada uno pide su método. Ver el
            mapa completo en el botón i.
          </p>
        </div>
        <CuadrantePatrones adi={c.adi} cv2={c.cv2} hayConsumo={c.mesesActivos > 0} />
      </Bloque>

      {/* 4 · ABC según valor $ */}
      <Bloque
        titulo="4 · ABC según valor $"
        bloqueado={faltaCosto}
        info={
          <InfoDialog
            titulo="ABC según valor $ · cómo leerlo"
            intro="El ABC ordena el catálogo por la plata que mueve, para dedicarle la atención a los pocos artículos que concentran casi todo el valor."
          >
            <InfoItem titulo="Valor consumido">
              <InfoFila etiqueta="¿Qué es?">
                Todo lo consumido en la ventana, multiplicado por el costo unitario. Es el insumo del Pareto:
                típicamente el 20% de los artículos concentra el 80% de este valor — esos son la clase A.
              </InfoFila>
              <InfoFila etiqueta="¿Para qué sirve?" tono="verde">
                Los A se controlan fino (stock ajustado, revisión frecuente); los C se administran simple
                (lotes grandes, revisión esporádica).
              </InfoFila>
            </InfoItem>
            <InfoItem titulo="Valor inmovilizado">
              <InfoFila etiqueta="¿Qué es?">El stock de hoy multiplicado por el costo: la plata dormida en los estantes.</InfoFila>
              <InfoFila etiqueta="¿Para qué sirve?" tono="verde">
                Cruzado con la cobertura muestra dónde hay capital de más: mucho valor inmovilizado con
                cobertura de un año es plata que podría estar en otro lado.
              </InfoFila>
            </InfoItem>
            <InfoItem titulo="Por qué acá no aparece la letra A, B o C">
              <InfoFila etiqueta="La razón" tono="rojo">
                La letra sale de comparar este artículo contra todo el catálogo ordenado. Un artículo solo no
                tiene letra: necesita el Pareto completo, que vive en el tablero general.
              </InfoFila>
            </InfoItem>
            <InfoItem titulo="Criticidad operativa">
              <InfoFila etiqueta="¿Qué es?">
                Un dato subjetivo: lo fija la política de la empresa según qué frena el servicio, y ningún
                cálculo puede deducirlo ni modificarlo.
              </InfoFila>
              <InfoFila etiqueta="¿Para qué sirve?" tono="verde">
                Es el corrector del ABC. Un conector de 1,80 USD es clase C por valor, pero si su faltante
                frena instalaciones, la criticidad 1 lo obliga a tratarse como A.
              </InfoFila>
            </InfoItem>
          </InfoDialog>
        }
      >
        <Proposito>
          Cuánta plata mueve y cuánta hay dormida. Es lo que decide a qué artículos dedicarles atención —
          independiente de la política del bloque 3.
        </Proposito>
        <Formula>valor consumido = Σ consumo × costo unitario = {nf(c.total)} × {nf(data.costo, 2)} USD</Formula>
        <Resultado
          valor={c.valorConsumido !== null ? nf(c.valorConsumido) : "—"}
          unidad="USD"
          destacado={!faltaCosto}
          interp="el insumo del Pareto: contra esto se comparan todos los artículos"
        />
        <Formula>valor inmovilizado = stock × costo unitario = {nf(p.stock)} × {nf(data.costo, 2)}</Formula>
        <Resultado
          valor={c.valorInmovilizado !== null ? nf(c.valorInmovilizado) : "—"}
          unidad="USD"
          destacado={!faltaCosto}
          interp="la plata dormida hoy en los estantes"
        />
        <Formula>
          criticidad operativa · subjetiva: la fija la política de la empresa, ningún cálculo la deduce ni la cambia
        </Formula>
        <Resultado valor={p.criticidad ? String(p.criticidad) : "—"} unidad="de 3" />
        <FaltaDato>
          {faltaCosto
            ? "Falta el costo unitario: cargá precios del proveedor seleccionado en la pestaña Artículo."
            : "La letra A, B o C solo sale comparando contra el resto del catálogo: hace falta el Pareto completo. Criticidad 1 fuerza tratamiento de clase A aunque el Pareto lo ubique en C."}
        </FaltaDato>
      </Bloque>

      {/* 5 · Kit */}
      {p.kitCantidad != null && p.kitCantidad > 0 && (
        <Bloque
          titulo="5 · Demanda derivada del kit"
          info={
            <InfoDialog
              titulo="Demanda derivada del kit · cómo leerla"
              intro="Cuando un artículo vive dentro de un kit, su demanda no se pronostica: se multiplica."
            >
              <InfoItem titulo="Teórico vs. real">
                <InfoFila etiqueta="Teórico">
                  Instalaciones proyectadas × cantidad por kit. Si se harán 707 instalaciones y cada una lleva
                  2 conectores, el mes necesita 1.414 — sin mirar la historia.
                </InfoFila>
                <InfoFila etiqueta="Real">Lo que efectivamente salió del depósito, promedio de los 24 meses.</InfoFila>
              </InfoItem>
              <InfoItem titulo="Rendimiento · el detector">
                <InfoFila etiqueta="¿Qué mide?" tono="verde">
                  Cuánto se desvía el consumo real del estándar del kit. Hasta ±{UMBRAL_KIT}% se considera normal.
                </InfoFila>
                <InfoFila etiqueta="Si da muy alto" tono="rojo">
                  O el estándar está mal calibrado, o hay merma, recorte no devuelto o fuga. Comprar contra un
                  estándar así garantiza el quiebre crónico: primero se corrige el estándar, después se compra.
                </InfoFila>
              </InfoItem>
            </InfoDialog>
          }
        >
          <Proposito>
            Pertenece a «{p.kitNombre ?? "kit"}»: su demanda no se pronostica, se multiplica por la cantidad
            de trabajos.
          </Proposito>
          <Formula>
            teórico por mes = instalaciones × cantidad por kit = {nf(p.instalacionesMes)} × {nf(p.kitCantidad)}
          </Formula>
          <Resultado valor={c.kitTeoricoMes !== null ? nf(c.kitTeoricoMes) : "—"} unidad={`${p.unidadBase}/mes`} />
          <Formula>real por mes = Σ consumo de 2 años ÷ {MESES_VENTANA} = {nf(c.total)} ÷ {MESES_VENTANA}</Formula>
          <Resultado valor={nf(c.realMes)} unidad={`${p.unidadBase}/mes`} />
          <Formula>rendimiento = real ÷ teórico − 1</Formula>
          <Resultado
            valor={
              c.kitRendimientoPct !== null
                ? `${c.kitRendimientoPct > 0 ? "+" : ""}${nf(c.kitRendimientoPct)}`
                : "—"
            }
            unidad="%"
            destacado={c.kitRendimientoPct !== null}
            interp={c.kitRendimientoPct !== null ? `hasta ±${UMBRAL_KIT}% se considera normal` : undefined}
          />
          <FaltaDato>
            {c.kitRendimientoPct === null
              ? "Cargá instalaciones proyectadas en la pestaña Artículo."
              : Math.abs(c.kitRendimientoPct) > UMBRAL_KIT
                ? "Desvío grande: o el estándar del kit no refleja la realidad, o hay merma, recorte no devuelto o fuga. Corregir el estándar antes de comprar contra él."
                : "El estándar del kit resiste la comparación con el consumo real."}
          </FaltaDato>
        </Bloque>
      )}

      {/* 6 · Confiabilidad */}
      <Bloque titulo="Qué falta para que todo esto sea confiable">
        <div className="flex flex-col gap-1">
          {data.checklist.map((it) => (
            <div key={it.titulo} className="flex items-start gap-2 py-0.5 text-sm">
              <span
                className={`font-mono font-semibold ${
                  it.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {it.ok ? "✓" : "✕"}
              </span>
              <span className={it.ok ? "text-muted-foreground" : ""}>
                {it.titulo}
                {!it.ok && <> — {it.porQue}</>}
              </span>
            </div>
          ))}
        </div>
      </Bloque>
    </div>
  );
}
