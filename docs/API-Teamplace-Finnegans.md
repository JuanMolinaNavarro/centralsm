# API Teamplace (Finnegans) — Productos y Stock

Documentación práctica de la **API de Teamplace / Finnegans**, enfocada en los casos que más interesan:

- **Crear** productos
- **Actualizar** productos
- **Eliminar** productos
- **Consultar stock**

> Fuente: definición Swagger 2.0 publicada por Finnegans S.A. (`Api Teamplace`).
> Contacto del proveedor: info@finneg.com · https://www.finneg.com

---

## 1. Conceptos generales

| Dato | Valor |
|------|-------|
| **Host de producción** | `api.teamplace.finneg.com` *(el spec Swagger declara `api.finneg.com`; ambos responden — para Teamplace usá el primero)* |
| **Base path** | `/api` |
| **URL base completa** | `https://api.teamplace.finneg.com/api` |
| **Esquema** | HTTPS |
| **Formato** | JSON (`Content-Type: application/json`) |
| **Autenticación** | OAuth 2.0 *client credentials* → token que viaja en el query string `ACCESS_TOKEN` |

> ⚠️ **Importante:** la `key` que aparece en el link del visor de Swagger
> (`...index.html?key=5d455c44595d5554595f43`) sirve **solo para visualizar la documentación**.
> **No** es la credencial de la API. Para consumir la API se usa `client_id` + `client_secret`
> con los que se obtiene un `ACCESS_TOKEN` (ver sección 2).

### Convenciones comunes

- **Token en cada llamada:** todas las operaciones (salvo `/oauth/token`) requieren el parámetro de query `ACCESS_TOKEN={token}`.
- **`{codigo}` en la ruta:** identifica la entidad sobre la que se opera (GET / PUT / DELETE individuales).
- **Selección "inteligente" en reportes:** los parámetros que referencian otra entidad aceptan el **código** directo, o la forma `arbol(nombre)` (busca primero como árbol y luego como nodo).
- **Fechas:** formato `yyyy-MM-dd`. Varios reportes aceptan además constantes relativas: `getCurrentDate`, `getFirstDayOfMonth`, `getLastDayOfMonth`, `getFirstDayOfYear`, `getLastDayOfYear`, `getFirstDayOfLastMonth`, `getLastDayOfLastMonth`, etc.

### Respuestas de estado

| HTTP | Cuerpo | Significado |
|------|--------|-------------|
| `200` | `{ "status": "created" }` | Alta exitosa (POST) |
| `200` | `{ "status": "updated" }` | Modificación exitosa (PUT) |
| `200` | `{ "status": "deleted" }` | Baja exitosa (DELETE) |
| `400` | `{ "error": "invalid token", "status": 400 }` | Token inválido / petición incorrecta |
| `404` | `{ "error": "credentials not found", "status": 404 }` | Credenciales no encontradas (solo en `/oauth/token`) |
| `500` | `{ "error": "Internal Server Error: ...", "status": 500 }` | Error interno del servidor |

---

## 2. Autenticación — Obtener el `ACCESS_TOKEN`

Para consumir la API necesitás un `ACCESS_TOKEN`, que se obtiene a partir de un `client_id` y un `client_secret`. Esas credenciales se generan en Teamplace (**Paso 1**) y con ellas se pide el token (**Paso 2**).

### Paso 1 — Obtener tus credenciales (`client_id` y `client_secret`)

Las credenciales **no se descargan de ningún lado externo**: se generan **dentro de Teamplace**, sobre el usuario con el que querés que queden registradas las operaciones de la API.

1. Iniciá sesión en Teamplace → https://access.teamplace.finneg.com
2. Andá a **Configuración → General → Seguridad → Usuarios** (en algunas versiones figura como *Usuarios internos* / maestro de Usuarios).
3. Abrí (doble clic) el **usuario** con el que vas a operar por API.
4. En la **barra de herramientas** del usuario, hacé clic en el botón **"Keys API"** (también aparece como *Keys api*).
5. Se abre un popup con los campos **Client id** y **Secret key**. La **primera vez están vacíos**: hacé clic en **"Generar keys"** para que se completen.
6. Copiá ambos valores → ese es tu **`client_id`** y tu **`client_secret`**.

> 🔁 Podés **regenerar** las keys volviendo a presionar el botón, pero al hacerlo **se invalidan las anteriores** (tendrías que actualizar cualquier integración que las use).
> 🔐 Las operaciones realizadas por la API quedan **registradas a nombre de ese usuario** y limitadas a **sus permisos**. Lo recomendable es crear un **usuario dedicado** para integraciones.
> 🧩 Si no ves el botón "Keys API" o el menú de Usuarios, probablemente tu usuario no tenga permisos de administración: pedíselo a quien administre el espacio de Teamplace de tu empresa.

### Paso 2 — Pedir el token

`GET /oauth/token`

Genera (o revalida) el token necesario para consumir el resto de la API.

#### Parámetros (query)

| Parámetro | Obligatorio | Descripción |
|-----------|-------------|-------------|
| `grant_type` | Sí | `client_credentials` (token nuevo) o `refresh_token` (refresco) |
| `client_id` | Sí | `client_id` del usuario de la API |
| `client_secret` | Sí | `client_secret` del usuario de la API |
| `refresh_token` | No | Token a revalidar (solo si `grant_type=refresh_token`) |

#### Ejemplo

```bash
curl "https://api.teamplace.finneg.com/api/oauth/token?grant_type=client_credentials&client_id=TU_CLIENT_ID&client_secret=TU_CLIENT_SECRET"
```

**Respuesta (200):** el token en **texto plano**, por ejemplo:

```
d51c823a-6e76-43ab-997b-fb6074e6a094
```

Ese valor es el que se usa luego como `ACCESS_TOKEN` en todas las llamadas.

> El token se reutiliza hasta que expira (suele durar unos minutos); cuando expire, volver a pedir uno (o usar `grant_type=refresh_token`).

**Si las credenciales son incorrectas** (o todavía no generaste las keys), la respuesta es:
`{"status":500,"error":"credentials not found"}`. Revisá que copiaste bien `client_id` / `client_secret` y que hiciste "Generar keys" en el Paso 1.

---

## 3. Productos

Entidad: **`producto`** · Cuerpo: **`ProductoVO`**

| Operación | Método | Ruta |
|-----------|--------|------|
| Crear producto | `POST` | `/producto` |
| Consultar un producto | `GET` | `/producto/{codigo}` |
| Listar productos | `GET` | `/producto/list` |
| Actualizar producto | `PUT` | `/producto/{codigo}` |
| Eliminar producto | `DELETE` | `/producto/{codigo}` |

### 3.1. Crear producto — `POST /producto`

```
POST https://api.teamplace.finneg.com/api/producto?ACCESS_TOKEN={token}
Content-Type: application/json
```

El cuerpo es un objeto `ProductoVO` (ver **3.6** para el detalle completo de campos).

#### Campos obligatorios

Estos campos deben estar **presentes** en el JSON. Los de tipo lista pueden enviarse como arreglo vacío `[]` cuando no aplican:

`Codigo`, `Nombre`, `EsStockeable`, `ManejaStockOrganizaciones`, `NoControlaStock`, `UtilizaPartidas`, `UtilizaNumerosSerie`, `ComposicionKit`, `Depositos`, `ProductoProveedor`, `Retenciones`, `Dimensiones`, `Codigo de Barras`, `Tasas Impositivas`.

#### Ejemplo mínimo — producto **no** stockeable (ej. un servicio)

```bash
curl -X POST "https://api.teamplace.finneg.com/api/producto?ACCESS_TOKEN=TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "Codigo": "SERV001",
    "Nombre": "Servicio de Consultoría",
    "Descripcion": "Hora de consultoría profesional",
    "Activo": true,
    "EsStockeable": false,
    "ManejaStockOrganizaciones": false,
    "NoControlaStock": 1,
    "UtilizaPartidas": false,
    "UtilizaNumerosSerie": false,
    "ComposicionKit": [],
    "Depositos": [],
    "ProductoProveedor": [],
    "Retenciones": [],
    "Dimensiones": [],
    "Codigo de Barras": [],
    "Tasas Impositivas": []
  }'
```

#### Ejemplo — producto **stockeable** con depósito

```bash
curl -X POST "https://api.teamplace.finneg.com/api/producto?ACCESS_TOKEN=TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "Codigo": "PROD001",
    "Nombre": "Tornillo M6 x 40",
    "Descripcion": "Tornillo hexagonal acero inoxidable",
    "Activo": true,
    "EsStockeable": true,
    "ManejaStockOrganizaciones": false,
    "NoControlaStock": 0,
    "UtilizaPartidas": false,
    "UtilizaNumerosSerie": false,
    "MonedaCodigo": "PES",
    "UnidadCodigoStock1": "UNI",
    "UnidadCodigoVenta": "UNI",
    "UnidadCodigoCompra": "UNI",
    "ConceptoCodigoLogistica": "MERCADERIA",
    "ProductoFamiliaCodigo": "FERRETERIA",
    "Depositos": [
      {
        "DepositoCodigo": "DEP01",
        "NoControlaStock": false,
        "StockMinimo": 10,
        "StockMaximo": 500,
        "PuntoReposicion": 50
      }
    ],
    "ComposicionKit": [],
    "ProductoProveedor": [],
    "Retenciones": [],
    "Dimensiones": [],
    "Codigo de Barras": [],
    "Tasas Impositivas": []
  }'
```

**Respuesta (200):** `{ "status": "created" }`

> 💡 Los campos `MonedaCodigo`, `UnidadCodigoStock1`, `ConceptoCodigoLogistica` y la sección `Depositos`
> solo son requeridos cuando `EsStockeable = true`. Los códigos referenciados (unidad, moneda, depósito,
> familia, etc.) deben existir previamente; se obtienen de las APIs de listado correspondientes (ver **3.7**).

---

### 3.2. Consultar un producto — `GET /producto/{codigo}`

Devuelve el `ProductoVO` completo de un producto.

```bash
curl "https://api.teamplace.finneg.com/api/producto/PROD001?ACCESS_TOKEN=TU_TOKEN"
```

---

### 3.3. Listar productos — `GET /producto/list`

Devuelve un listado resumido (`codigo`, `nombre`, `descripcion`, `activo`).

#### Parámetros (query)

| Parámetro | Obligatorio | Descripción |
|-----------|-------------|-------------|
| `ACCESS_TOKEN` | Sí | Token de autorización |
| `updatedSince` | No | Trae solo lo modificado desde esa fecha (`yyyy-MM-dd`) |
| *(condiciones del diccionario)* | No | Filtros adicionales según los códigos de condición de la entidad (comparación *case-insensitive*). Para múltiples valores, separar con `;` |

> Se omiten automáticamente: `example`, `updatedSince`, `ACCESS_TOKEN`.

```bash
# Todos los productos
curl "https://api.teamplace.finneg.com/api/producto/list?ACCESS_TOKEN=TU_TOKEN"

# Solo los modificados desde una fecha
curl "https://api.teamplace.finneg.com/api/producto/list?ACCESS_TOKEN=TU_TOKEN&updatedSince=2026-01-01"

# Con filtros por condición (ejemplo del proveedor)
curl "https://api.teamplace.finneg.com/api/producto/list?ACCESS_TOKEN=TU_TOKEN&codigo=ABC123&estado=ACTIVO"
```

**Respuesta (200):**

```json
[
  { "codigo": "PROD001", "nombre": "Tornillo M6 x 40", "descripcion": "Tornillo hexagonal...", "activo": true },
  { "codigo": "SERV001", "nombre": "Servicio de Consultoría", "descripcion": "Hora...", "activo": true }
]
```

> Existe además un reporte alternativo `GET /reports/productoList` (ver **3.8**) con otros filtros.

---

### 3.4. Actualizar producto — `PUT /producto/{codigo}`

```
PUT https://api.teamplace.finneg.com/api/producto/{codigo}?ACCESS_TOKEN={token}
Content-Type: application/json
```

El cuerpo usa la misma estructura `ProductoVO`. El `{codigo}` de la ruta identifica el producto a modificar.

#### Parámetro adicional (query)

| Parámetro | Valores | Descripción |
|-----------|---------|-------------|
| `createIfNotExists` | `1` / `0` | Si vale `1`, **crea** la entidad si no existe (upsert). Si vale `0` o se omite, solo actualiza. |

```bash
curl -X PUT "https://api.teamplace.finneg.com/api/producto/PROD001?ACCESS_TOKEN=TU_TOKEN&createIfNotExists=0" \
  -H "Content-Type: application/json" \
  -d '{
    "Codigo": "PROD001",
    "Nombre": "Tornillo M6 x 40 (reforzado)",
    "Descripcion": "Nueva descripción",
    "Activo": true,
    "EsStockeable": true,
    "ManejaStockOrganizaciones": false,
    "NoControlaStock": 0,
    "UtilizaPartidas": false,
    "UtilizaNumerosSerie": false,
    "ComposicionKit": [],
    "Depositos": [],
    "ProductoProveedor": [],
    "Retenciones": [],
    "Dimensiones": [],
    "Codigo de Barras": [],
    "Tasas Impositivas": []
  }'
```

**Respuesta (200):** `{ "status": "updated" }`

> 💡 Para evitar resultados inesperados, lo más seguro es **enviar el objeto completo** (idealmente
> obtenido previamente con `GET /producto/{codigo}`) con los campos ya modificados, manteniendo
> presentes los campos obligatorios.

---

### 3.5. Eliminar producto — `DELETE /producto/{codigo}`

```bash
curl -X DELETE "https://api.teamplace.finneg.com/api/producto/PROD001?ACCESS_TOKEN=TU_TOKEN"
```

**Respuesta (200):** `{ "status": "deleted" }`

---

### 3.6. Referencia de campos de `ProductoVO`

**Convención de tipos:** `(String)`, `(Int)`, `(Decimal/number)`, `(Boolean)`. Las claves con espacios
(`Codigo de Barras`, `Tasas Impositivas`) van **literalmente con el espacio** en el JSON.

#### Identificación y datos generales

| Campo | Tipo | Oblig. | Descripción |
|-------|------|:-----:|-------------|
| `Codigo` | String | ✅ | Código del producto |
| `Nombre` | String | ✅ | Nombre del producto |
| `Descripcion` | String | | Descripción |
| `Activo` | Boolean | | Indica si queda activo (`true`/`false`) |
| `ProductoImagen` | String | | URL de la imagen |
| `CodigoMercosur` | String | | Código Mercosur |
| `CodigoMtx` / `UnidadesMtx` | String | | Códigos MTX |
| `ProductoTipo` | String | | `OTR`=Otros, `ENVASE`, `COMBUSTIBLE`, `MAQUINA` |
| `EsDiscontinuo` / `FechaDiscontinuo` | Boolean / Date | | Marca de discontinuado y su fecha |
| `EsPadre` / `ProductoPadre_Codigo` | Boolean / String | | Jerarquía de productos |

#### Control de stock

| Campo | Tipo | Oblig. | Descripción |
|-------|------|:-----:|-------------|
| `EsStockeable` | Boolean | ✅ | Si el producto maneja stock (`true`/`false`) |
| `ManejaStockOrganizaciones` | Boolean | ✅ | Solo si es stockeable |
| `NoControlaStock` | Int | ✅ | `0`=Controla por Organización, `1`=No controla, `2`=Controla sin considerar Organización |
| `UtilizaPartidas` | Boolean | ✅ | Solo si es stockeable |
| `UtilizaNumerosSerie` | Boolean | ✅ | Solo si es stockeable |
| `ControlaStockPorNumeroSerie` | Boolean | | Solo si es stockeable |
| `PartidaTipoCodigo` | String | | Obligatorio si usa partidas — API `/TipoPartida/list` |
| `EsKit` | Boolean | | Solo si es stockeable |
| `EsElaborado` | Boolean | | Solo si es stockeable |
| `UsaFactorMultiplicacion` / `FactorMultiplicacion` | Boolean / Decimal | | Solo si es stockeable y elaborado |

#### Unidades y equivalencias

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `UnidadCodigoStock1` | String | Unidad de stock principal. **Obligatoria si es stockeable** — API `/Unidades/list` |
| `UnidadCodigoStock2` | String | Segunda unidad de stock |
| `UnidadCodigoVenta` | String | Unidad de venta — API `/Unidades/list` |
| `UnidadCodigoCompra` | String | Unidad de compra — API `/Unidades/list` |
| `UnidadIDAbastecimiento_Codigo` | String | Unidad de abastecimiento |
| `RelacionUnidadVentaStock` | Decimal | Equivalencia venta ↔ stock |
| `RelacionUnidadCompraStock` | Decimal | Equivalencia compra ↔ stock |
| `RelacionUnidadAbastecimientoStock` | Decimal | Equivalencia abastecimiento ↔ stock |
| `RelacionUnidadSecundaria` | Decimal | Segunda unidad de almacenamiento |
| `RelacionUnidadTransporte` | Decimal | Relación de transporte |
| `MantenerUnidadSecundariaDeStock` | Boolean | |
| `UnidadValorizacion` | Int | `-1`=Sin asignar, `0`=Unidad Stock 1, `1`=Unidad Stock 2 |

#### Precios, costos e impuestos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `MonedaCodigo` | String | **Obligatoria si es stockeable** — API `/Moneda/list` |
| `PrecioBaseVenta` | Decimal | Precio base de venta |
| `CostoStandard` / `FechaCostoStandard` | Decimal / Date | Costo estándar y su fecha |
| `ActualizaVNR` | Boolean | Actualiza automáticamente el costo estándar |
| `Valoriza` | Boolean | Si el producto se valoriza |
| `EsquemaValorizacion` | String | Esquema de valorización a usar |
| `ActividadIVACodigo` | String | API `/ActividadesIva/list` |
| `TasaImpositivaCodigoVenta` | String | API `/TasasImpositivas/list` |
| `TasaImpositivaCodigoCompra` | String | API `/TasasImpositivas/list` |
| `ImporteImpuestosInternos` | Decimal | |
| `CategoriaSIAP` | Int | `1`=Bienes, `2`=Bienes de Uso, `6`=Bienes en el exterior, `3`=Locaciones, `5`=Servicios, `7`=Servicios en el exterior, `4`=Otros |
| `TipoOperacion` | Int | `1`=Venta cosas muebles/obras/locaciones/servicios, `2`=Venta Bienes de Uso, `3`=No gravadas/exentas |
| `PorcentajeComision` | Decimal | |

#### Imputación contable

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `CuentaCodigoVenta` | String | API `/Cuenta/list` |
| `CuentaCodigoCompra` | String | API `/Cuenta/list` |
| `ConceptoCodigoVenta` | String | API `/ConceptoProducto/list` |
| `ConceptoCodigoCompra` | String | API `/ConceptoProducto/list` |
| `ConceptoCodigoLogistica` | String | Solo si es stockeable — API `/ConceptoProducto/list` |

#### Clasificación / comercial

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `ProductoFamiliaCodigo` | String | API `/FamiliaProducto/list` |
| `ProductoSubFamiliaCodigo` | String | API `/SufamiliaProducto/list` |
| `ProductoRubroCodigo` | String | API `/RubroProducto/list` |
| `MarcaCodigo` | String | API `/Marca/list` |
| `ProveedorCodigoPrincipal` | String | Proveedor principal — API `/Proveedores/list` |
| `PosicionArancelariaCodigo` | String | API `/PosicionArancelaria/list` |

#### Físico / logística

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `Peso` | Decimal | |
| `Volumen` | Decimal | |
| `PisoDePallet` | Int | |
| `UtilizaDespachoImportacion` | Boolean | |
| `ProductoCodigoEnvase` | String | Productos tipo Envase — API `/Producto/list` |

#### Colecciones (arrays)

Todas son **obligatorias como propiedad** (pueden ir como `[]`):

**`Depositos`** — configuración por depósito (solo si es stockeable):

| Sub-campo | Tipo | Oblig. | Descripción |
|-----------|------|:-----:|-------------|
| `DepositoCodigo` | String | | API `/Depositos/list` |
| `NoControlaStock` | Boolean | ✅ | |
| `StockMinimo` | Decimal | | |
| `StockMaximo` | Decimal | | |
| `PuntoReposicion` | Decimal | | |

**`ComposicionKit`** — solo si es stockeable y `EsKit = true`:

| Sub-campo | Tipo | Descripción |
|-----------|------|-------------|
| `ProductoCodigoKit` | String | Componente del kit — API `/Producto/list` |
| `Cantidad` | Decimal | Cantidad del componente |

**`Codigo de Barras`** — presentaciones / códigos de barra:

| Sub-campo | Tipo | Descripción |
|-----------|------|-------------|
| `CodigoBarra` | String | Código de barras |
| `Multiplicador` | Decimal | Unidades que identifica el código |
| `UnidadCodigoPresentacion` | String | API `/Unidades/list` |
| `Orden` | Int | Orden en el combo de presentaciones |

**`ProductoProveedor`** — código del producto en cada proveedor:

| Sub-campo | Tipo | Oblig. | Descripción |
|-----------|------|:-----:|-------------|
| `OrganizacionID_Codigo` | String | ✅ | Código del proveedor (Organización) |
| `CodigoProductoProveedor` | String | ✅ | Código del producto según el proveedor |

**`Retenciones`**:

| Sub-campo | Tipo | Descripción |
|-----------|------|-------------|
| `RetencionCodigo` | String | Concepto — API `/Retencion/list` |
| `TipoRetencionCodigo` | String | Tipo — API `/RetencionTipo/list` |

**`Dimensiones`**:

| Sub-campo | Tipo | Oblig. | Descripción |
|-----------|------|:-----:|-------------|
| `DimensionCodigo` | String | ✅ | API `/Dimension/list` |
| `DimensionDistribucionCodigo` | String | | API `/Dimension/list` |

**`Tasas Impositivas`** (útil con empresas en más de un país):

| Sub-campo | Tipo | Descripción |
|-----------|------|-------------|
| `TasaImpositivaCodigo` | String | API `/TasaImpositiva/list` |

---

### 3.7. APIs de apoyo (catálogos para armar el producto)

Para completar los códigos referenciados en `ProductoVO`:

| Dato | Endpoint |
|------|----------|
| Unidades | `GET /unidad/list` |
| Monedas | `GET /moneda/list` |
| Marcas | `GET /marca/list` |
| Familias de producto | `GET /productoFamilia/list` |
| Subfamilias de producto | `GET /productoSubfamilia/list` |
| Rubros de producto | `GET /productoRubro/list` |
| Tasas impositivas | `GET /tasaImpositiva/list` |
| Actividades IVA | `GET /actividadIVA/list` |
| Cuentas | `GET /cuenta/list` |
| Retenciones / Tipos | `GET /retencion/list` · `GET /retencionTipo/list` |
| Proveedores | `GET /proveedor/list` |

---

### 3.8. Reporte alternativo de productos — `GET /reports/productoList`

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `empresa` | String | Empresa |
| `fechaUltModificacion` | Date | Fecha de última modificación (`yyyy-MM-dd` o constante relativa) |
| `ProductoVenta` | Boolean | Filtra solo productos de venta |

```bash
curl "https://api.teamplace.finneg.com/api/reports/productoList?ACCESS_TOKEN=TU_TOKEN&ProductoVenta=true&fechaUltModificacion=2026-01-01"
```

---

## 4. Consultar Stock

La API ofrece varios **reportes de stock**. Todos son `GET`, bajo `/reports/...`, y usan parámetros
con prefijo `PARAMWEBREPORT_`. La mayoría de los filtros son opcionales; **`PARAMWEBREPORT_MonedaID` es obligatorio**
en los reportes detallados/resumen.

| Reporte | Ruta | Agrupa por | Uso típico |
|---------|------|:---------:|------------|
| **Stock por depósito** (detallado) | `/reports/stockDeposito` | Depósito | Stock por producto y depósito |
| **Stock por empresa** | `/reports/stockEmpresa` | Empresa | Stock consolidado por empresa-sucursal |
| **Resumen por depósito** | `/reports/resumenStockPorDeposito` | Depósito | Resumen agrupado por depósito |
| **Resumen por empresa** | `/reports/resumenStockPorEmpresa` | Empresa | Resumen agrupado por empresa |
| **Resumen de stock** | `/reports/RESUMENSTOCK` | Depósito | Resumen general |
| **Stock con precio** | `/reports/stockDepositoPrecio` | — | Stock valorizado contra una lista de precios |

### 4.1. Stock por depósito — `GET /reports/stockDeposito`

Reporte detallado de existencias por producto / depósito / partida.

#### Parámetros (query, prefijo `PARAMWEBREPORT_`)

| Parámetro | Tipo | Oblig. | Descripción |
|-----------|------|:-----:|-------------|
| `PARAMWEBREPORT_MonedaID` | String | ✅ | Moneda de valorización — API `/moneda/list` |
| `PARAMWEBREPORT_fecha` | Date | | Fecha hasta (`yyyy-MM-dd` o constante relativa) |
| `PARAMWEBREPORT_producto` | String | | Código de producto (o `arbol(nombre)`) |
| `PARAMWEBREPORT_deposito` | String | | Código de depósito |
| `PARAMWEBREPORT_organizacion` | String | | Código de organización |
| `PARAMWEBREPORT_ConceptoID` | String | | Concepto de producto |
| `PARAMWEBREPORT_numeroPartida` | String | | Partida |
| `PARAMWEBREPORT_circuitocontable` | String | | Circuito contable |
| `PARAMWEBREPORT_Empresa` | String | | Empresa-sucursal |
| `PARAMWEBREPORT_tipoStock` | Number | | Tipo de stock |
| `PARAMWEBREPORT_soloStockNoCero` | Boolean | | Solo con stock distinto de cero |
| `PARAMWEBREPORT_soloStockDebajoPtoReposicion` | Boolean | | Solo por debajo del punto de reposición |
| `PARAMWEBREPORT_soloDepositos` | Number | | Filtro "Ver solo" |
| `PARAMWEBREPORT_TipoPrecio` | Number | | Tipo de precio |
| `PARAMWEBREPORT_AgruparPor` | Number | | Agrupación (`1`=depósito) |

```bash
# Stock de un producto en todos los depósitos, valorizado en pesos
curl "https://api.teamplace.finneg.com/api/reports/stockDeposito?ACCESS_TOKEN=TU_TOKEN&PARAMWEBREPORT_MonedaID=PES&PARAMWEBREPORT_producto=PROD001"

# Solo ítems con stock, a una fecha, en un depósito
curl "https://api.teamplace.finneg.com/api/reports/stockDeposito?ACCESS_TOKEN=TU_TOKEN&PARAMWEBREPORT_MonedaID=PES&PARAMWEBREPORT_deposito=DEP01&PARAMWEBREPORT_fecha=getCurrentDate&PARAMWEBREPORT_soloStockNoCero=true"
```

#### Campos de la respuesta

| Campo | Descripción |
|-------|-------------|
| `PRODUCTO` | Nombre del producto |
| `PRODUCTOCODIGO` | Código del producto |
| `DEPOSITO` | Depósito |
| `CANTIDAD1` | Stock en unidad principal |
| `CANTIDAD2` | Stock en unidad secundaria |
| `UNIDAD1` / `UNIDAD2` | Unidad principal / secundaria |
| `STOCKDISPONIBLE` | Stock disponible |
| `STOCKRESERVADO` | Stock reservado |
| `PUNTOREPOSICION` | Punto de reposición |
| `CANTIDADSTOCKAREPONER` | Stock a reponer |
| `CANTIDADGESTIONAR` | Cantidad a gestionar |
| `IMPORTE` | Importe valorizado |
| `PARTIDA` / `PARTIDA_ALTA` / `PARTIDA_VTO` | Partida y sus fechas |
| `ESTADOPARTIDA` | Estado de la partida |

### 4.2. Stock por empresa / Resúmenes

`/reports/stockEmpresa`, `/reports/resumenStockPorEmpresa`, `/reports/resumenStockPorDeposito` y
`/reports/RESUMENSTOCK` aceptan **los mismos parámetros** que `stockDeposito` (cambia el valor por defecto
de `PARAMWEBREPORT_AgruparPor`: `2` para los agrupados por empresa, `1` para los de depósito). `MonedaID` también es obligatorio.

```bash
curl "https://api.teamplace.finneg.com/api/reports/stockEmpresa?ACCESS_TOKEN=TU_TOKEN&PARAMWEBREPORT_MonedaID=PES&PARAMWEBREPORT_Empresa=EMP01"
```

### 4.3. Stock valorizado con lista de precios — `GET /reports/stockDepositoPrecio`

| Parámetro | Oblig. | Descripción |
|-----------|:-----:|-------------|
| `PARAMWEBREPORT_Deposito` | ✅ | Código de depósito |
| `PARAMWEBREPORT_ListaPrecio` | ✅ | Lista de precios |
| `PARAMWEBREPORT_DepositoFull` | | Depósito full |
| `PARAMWEBREPORT_Empresa` | | Empresa-sucursal |

```bash
curl "https://api.teamplace.finneg.com/api/reports/stockDepositoPrecio?ACCESS_TOKEN=TU_TOKEN&PARAMWEBREPORT_Deposito=DEP01&PARAMWEBREPORT_ListaPrecio=LISTA01"
```

---

## 5. Ajustar / mover stock — `POST /AjusteStock`

Los reportes anteriores **solo consultan**. Para **modificar existencias** (ajustes de inventario,
ingresos/egresos, movimientos entre depósitos) se usa la entidad **`AjusteStock`** con el cuerpo `OperacionVO`.

| Operación | Método | Ruta |
|-----------|--------|------|
| Crear ajuste | `POST` | `/AjusteStock` |
| Consultar ajuste | `GET` | `/AjusteStock/{codigo}` |
| Actualizar ajuste | `PUT` | `/AjusteStock/{codigo}` |
| Eliminar ajuste | `DELETE` | `/AjusteStock/{codigo}` |

### Campos de `OperacionVO`

**Cabecera** (obligatorios: `FechaComprobante`, `Fecha`, `FechaBaseVencimiento`, `OperacionItems`):

| Campo | Tipo | Oblig. | Descripción |
|-------|------|:-----:|-------------|
| `Fecha` | Date | ✅ | Fecha de la operación |
| `FechaComprobante` | Date | ✅ | Fecha del comprobante |
| `FechaBaseVencimiento` | Date | ✅ | Fecha base de vencimiento |
| `OperacionItems` | Array | ✅ | Renglones del ajuste (ver abajo) |
| `EmpresaID` | String | | Empresa — FK `FAFEmpresa` |
| `TalonarioID` | String | | Talonario — FK `BSTalonario` |
| `TransaccionSubtipoID` | String | | Subtipo de transacción — FK `FAFTransaccionSubtipo` |
| `NumeroDocumento` | String | | Número de documento |
| `IdentificacionExterna` | String | | Identificación externa |
| `Descripcion` | String | | Descripción |

**`OperacionItems[]`** (cada renglón; obligatorio: `Tipo`):

| Campo | Tipo | Oblig. | Descripción |
|-------|------|:-----:|-------------|
| `Tipo` | Int | ✅ | Tipo de movimiento del renglón |
| `ProductoID` | String | | Producto — FK `BSProducto` |
| `CantidadStock1` | Decimal | | Cantidad en unidad principal |
| `CantidadStock2` | Decimal | | Cantidad en unidad secundaria |
| `DepositoIDOrigen` | String | | Depósito origen — FK `BSDeposito` |
| `DepositoIDDestino` | String | | Depósito destino (para movimientos) — FK `BSDeposito` |
| `PartidaNumero` | String | | Número de partida |
| `NumeroSerie` | String | | Números de serie separados por coma |
| `UnidadVentaID` / `UnidadCompraID` / `UnidadIDStock2` | String | | Unidades |
| `Descripcion` | String | | Descripción del renglón |
| `DimensionDistribucion` | Array | | Distribución por dimensiones (centro de costo, etc.) |

```bash
curl -X POST "https://api.teamplace.finneg.com/api/AjusteStock?ACCESS_TOKEN=TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "Fecha": "2026-06-08",
    "FechaComprobante": "2026-06-08",
    "FechaBaseVencimiento": "2026-06-08",
    "EmpresaID": "EMP01",
    "OperacionItems": [
      {
        "Tipo": 1,
        "ProductoID": "PROD001",
        "DepositoIDOrigen": "DEP01",
        "CantidadStock1": 25
      }
    ]
  }'
```

**Respuesta (200):** `{ "status": "created" }`

> El significado exacto de `Tipo` y del `TransaccionSubtipoID` depende de la configuración de
> transacciones de stock de cada instalación de Teamplace. Consultar con el administrador funcional
> qué subtipo usar para ajuste de inventario vs. movimiento entre depósitos.

---

## 6. Resumen de endpoints (cheat sheet)

```text
# Autenticación
GET    /oauth/token?grant_type=client_credentials&client_id=...&client_secret=...

# Productos
POST   /producto                         (body: ProductoVO)            → crear
GET    /producto/{codigo}                                              → consultar
GET    /producto/list                                                  → listar
PUT    /producto/{codigo}?createIfNotExists=0  (body: ProductoVO)      → actualizar
DELETE /producto/{codigo}                                              → eliminar

# Consultar stock (solo lectura)
GET    /reports/stockDeposito            ?PARAMWEBREPORT_MonedaID=...   → stock por depósito
GET    /reports/stockEmpresa             ?PARAMWEBREPORT_MonedaID=...   → stock por empresa
GET    /reports/resumenStockPorDeposito  ?PARAMWEBREPORT_MonedaID=...
GET    /reports/resumenStockPorEmpresa   ?PARAMWEBREPORT_MonedaID=...
GET    /reports/RESUMENSTOCK             ?PARAMWEBREPORT_MonedaID=...
GET    /reports/stockDepositoPrecio      ?PARAMWEBREPORT_Deposito=...&PARAMWEBREPORT_ListaPrecio=...

# Modificar stock
POST   /AjusteStock                      (body: OperacionVO)           → ajuste / movimiento

# (Todas, excepto /oauth/token, requieren ?ACCESS_TOKEN={token})
```

---

> **Nota final sobre el alcance.** La API completa de Teamplace expone ~475 endpoints (clientes,
> proveedores, facturas, cobranzas, pedidos, producción, RRHH, etc.). Este documento cubre solo
> **productos** y **stock**, que es lo solicitado. Si necesitás documentar otra entidad, el patrón
> es el mismo: `POST /Entidad`, `GET|PUT|DELETE /Entidad/{codigo}`, `GET /Entidad/list`, y el cuerpo
> es un `XxxVO` con la misma mecánica de campos.
