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

- Un único `index.html` con HTML, CSS y JavaScript nativo; sin framework, build, manifiesto de dependencias ni pruebas en la base inspeccionada.
- Fuentes externas de Google Fonts; no existe router ni servidor propio.
- Estado en memoria: categoría, fecha, historial y mes del calendario. Solo la URL del servicio persiste en el navegador.
- Persistencia de negocio: Google Sheets. Automatizaciones: Google Apps Script y Drive.
- `getURL()` elige la URL configurada o `URL_DEFAULT`. Las llamadas usan `fetch` y esperan JSON con `ok` y, en errores, `error`.
- `APPS_SCRIPT_CODE` contiene el código ofrecido para copiar. Modificarlo en GitHub no actualiza una implementación de Apps Script existente.
- No hay autenticación implementada en el frontend. Los permisos reales dependen de la implementación de Apps Script y de Google; no se han inspeccionado.
- No hay configuración de despliegue en el repositorio inspeccionado. No se ha confirmado el alojamiento de producción.

## Contrato con Google Sheets

- Cada mes corresponde a una pestaña con su nombre en español.
- Categorías y filas: Compra 16, Gasolina 26, Restaurantes 41, Farmacia 33. Columna del día: `dia + 3`.
- El código de ejemplo suma gastos sucesivos mediante fórmulas en la celda.
- `accion=reporte`: lee `Seguimiento <año actual>`, filas 4–61, grupo A, categoría B, presupuesto mensual C y gasto real P. Calcula presupuesto mensual × 12 y genera `Reporte <año actual>`.
- `accion=nuevo_anio`: copia el libro como `Presupuesto <año siguiente>`, limpia D4:AH61 de las pestañas mensuales, renombra seguimiento y elimina el reporte del año anterior en la copia.
- `resp()` serializa JSON con `ContentService`.

## Límites y precauciones

- No se dispone en Git del Apps Script desplegado ni del esquema completo de la hoja. El código embebido es evidencia del contrato previsto, no prueba de lo ejecutado en producción.
- El registro envía mes y día, sin año; el destino lo determina el libro asociado a la URL.
- Evitar pruebas de escritura contra la URL predeterminada, la generación de copias y la regeneración de reportes sobre datos reales.
- Conservar estilos y flujos existentes: la petición actual se limita a problemas técnicos del audio.
- Verificar la sintaxis y los flujos afectados con servicios simulados. Validar la integración real con una copia de la hoja y una implementación de pruebas.

## Trabajo actual

Rama: `fix/revision-tecnica-audio`. Pendiente transcribir el audio adjunto, delimitar sus incidencias, implementar y validar. No integrar en `main` sin autorización explícita.
