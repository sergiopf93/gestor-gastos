# Contexto del proyecto

Revisión inicial: 13 de noviembre de 2026. Base inspeccionada: `f28633f` de `main`.

## Objetivo y flujos

- Registro de gastos: seleccionar Compra, Gasolina, Restaurantes o Farmacia, introducir un importe positivo y elegir fecha en un calendario. Se inicia con Compra y la fecha actual.
- Guardado: envía mes, categoría, día e importe al Apps Script. Tras una respuesta correcta muestra confirmación y añade el gasto al historial de la sesión; conserva categoría y fecha.
- Historial: últimos ocho registros de esta sesión; se pierde al recargar.
- Análisis de seguimiento: solicita desviaciones entre presupuesto anual y gasto real; muestra categorías con exceso y con margen.
- Generar año siguiente: solicita una copia del libro en Drive y muestra enlace e instrucciones para activar su Apps Script.
- Configuración: permite guardar una URL de Apps Script en `localStorage` (`gastos_script_url`), o restaurar la URL predeterminada.

## Arquitectura comprobada

- Un único `index.html` de ejecución con HTML, CSS y JavaScript nativo; sin framework, build ni manifiesto de dependencias. Se han añadido pruebas con Node y un script de navegador opcional.
- Fuentes externas de Google Fonts; no existe router ni servidor propio.
- Estado en memoria: categoría, fecha, historial y mes del calendario. Solo la URL del servicio persiste en el navegador.
- Persistencia de negocio: Google Sheets. Automatizaciones: Google Apps Script y Drive.
- `getURL()` elige la URL configurada o `URL_DEFAULT`. Las llamadas usan `fetch` y esperan JSON con `ok` y, en errores, `error`.
- La URL predeterminada se actualizó a la implementación facilitada por el usuario, verificada con `{"ok":true,"gastosIdempotentes":true}`. Se retira automáticamente una configuración guardada que coincida con la antigua URL predeterminada; otros destinos personalizados se conservan.
- `apps-script/Code.gs` es la fuente del servicio. `scripts/sync-apps-script.mjs` sincroniza `APPS_SCRIPT_CODE` para copiarlo desde la web. Modificar GitHub no actualiza una implementación de Apps Script existente.
- No hay autenticación implementada en el frontend. Los permisos reales dependen de la implementación de Apps Script y de Google; no se han inspeccionado.
- No hay configuración de despliegue en el repositorio inspeccionado. No se ha confirmado el alojamiento de producción.

## Contrato con Google Sheets

- Cada mes corresponde a una pestaña con su nombre en español.
- Categorías y filas: Compra 16, Gasolina 26, Restaurantes 41, Farmacia 33. Columna del día: `dia + 3`.
- El código de ejemplo suma gastos sucesivos mediante fórmulas en la celda.
- `accion=estado` devuelve `gastosIdempotentes: true` sin escribir. La web verifica esta capacidad antes de enviar gastos a un destino.
- Registro: añade `id` (timestamp + UUID). El ID se mantiene en `localStorage` hasta recibir confirmación con ese mismo ID. Un gasto nuevo confirmado libera la clave y permite otro gasto igual.
- El servicio usa `LockService.getScriptLock()` y recibos en `PropertiesService.getScriptProperties()` durante siete días. Persiste el resultado previsto antes de modificar la celda y recupera reintentos tras una confirmación fallida. Una celda vacía recibe un número; una celda con importe o fórmula recibe una suma. IDs antiguos o conflictos se rechazan sin una nueva suma.
- `accion=reporte`: lee `Seguimiento <año actual>`, filas 4–61, grupo A, categoría B, presupuesto mensual C y gasto real P. Calcula presupuesto mensual × 12 y genera `Reporte <año actual>`.
- `accion=nuevo_anio`: copia el libro como `Presupuesto <año siguiente>`, limpia D4:AH61 de las pestañas mensuales, renombra seguimiento y elimina el reporte del año anterior en la copia.
- `resp()` serializa JSON con `ContentService`.

## Límites y precauciones

- El usuario confirmó que el Apps Script desplegado coincide con la versión inicial incluida en la web. No se ha accedido directamente al proyecto de Google ni al esquema completo de la hoja.
- El registro envía mes y día, sin año; el destino lo determina el libro asociado a la URL.
- Evitar pruebas de escritura contra la URL predeterminada, la generación de copias y la regeneración de reportes sobre datos reales.
- Conservar estilos y flujos existentes: la petición actual se limita a problemas técnicos del audio.
- Verificar la sintaxis y los flujos afectados con servicios simulados. Validar la integración real con una copia de la hoja y una implementación de pruebas.

## Trabajo actual

Rama: `main`, por autorización explícita posterior del usuario. Audio transcrito localmente: a veces se duplica un gasto introducido desde la app; el usuario sospecha de su conversión en fórmula. No hay evidencia de que la conversión, por sí sola, duplique importes. Sí se ha comprobado que el código anterior suma de nuevo cada petición repetida.

Se implementan protección contra envíos simultáneos, identificadores persistentes, verificación de compatibilidad, validación estricta de importes, exclusión mutua y recuperación de escrituras sin confirmación. Se conservan interfaz, categorías, destino por URL y herramientas anuales.

Validación local: 11 pruebas de servicio y 7 comprobaciones de navegador con servicios simulados, todas correctas. El usuario confirmó que el código desplegado coincide con el original del repositorio. Pendiente actualizar la implementación de Google y validar sobre una copia de la hoja. No se han modificado datos reales.

Referencias de implementación: [LockService](https://developers.google.com/apps-script/reference/lock/lock-service), [PropertiesService](https://developers.google.com/apps-script/reference/properties/properties-service) y [SpreadsheetApp.flush](https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app#flush()).
