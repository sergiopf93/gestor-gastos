# Gestor de gastos

Aplicación web estática en español para registrar gastos en Google Sheets a través de Google Apps Script. La interfaz y el código de Apps Script que se ofrece para copiar están en `index.html`.

El código fuente del servicio está en [apps-script/Code.gs](apps-script/Code.gs). Un identificador persistente por envío evita volver a sumar un gasto al reintentarlo después de perder la respuesta. Los gastos nuevos, aunque tengan el mismo importe, se suman normalmente. El primer gasto de una celda vacía se guarda como número; los siguientes conservan la suma y las fórmulas existentes.

## Activar la corrección de duplicados

La URL predeterminada apunta a la implementación actualizada facilitada por el usuario y comprobada mediante `accion=estado`. Si el navegador tenía guardada la antigua URL predeterminada, la app la migra automáticamente al nuevo destino. Otras URLs personalizadas se conservan.

**Actualizar GitHub no actualiza Google Apps Script.** La web comprueba la compatibilidad antes de enviar el primer gasto a cada URL y bloqueará el guardado si el servicio sigue siendo antiguo.

1. En el libro que recibe los gastos, abrir **Extensiones → Apps Script** y guardar una copia del código actual.
2. Compararlo con `apps-script/Code.gs`. Si contiene personalizaciones distintas de la versión del repositorio, integrarlas antes de sustituirlo.
3. Pegar el contenido de `apps-script/Code.gs`, guardar y actualizar **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar**. Mantener la implementación existente conserva su URL.
4. Recargar la web. Si se creó una implementación con otra URL, actualizarla en ⚙️.
5. Validar primero en una copia de la hoja: guardar 12,50 en una celda vacía debe dejar 12,50; introducir otro gasto nuevo de 12,50 debe dejar 25. No se corrigen automáticamente los duplicados anteriores.

La incidencia del audio es una duplicación ocasional. El código anterior permitía aplicar dos veces una petición repetida; no se ha confirmado que esa sea la causa exacta de cada caso en producción. El usuario ha confirmado que el Apps Script desplegado coincide con el código original del repositorio.

## Uso y desarrollo

No requiere instalación, compilación ni dependencias de Node. Para servirla localmente:

```sh
python3 -m http.server 8000
```

Abrir `http://localhost:8000`. Las operaciones reales usan la URL de Apps Script configurada en el navegador y pueden modificar la hoja de cálculo. Para pruebas, utilizar una copia y una implementación de pruebas.

Para modificar el servicio, editar `apps-script/Code.gs` y actualizar el código que la web ofrece para copiar:

```sh
node scripts/sync-apps-script.mjs
```

## Comprobaciones

Con Node.js 22 o superior, sin instalar dependencias del proyecto:

```sh
node --test tests/gastos.test.mjs
node scripts/sync-apps-script.mjs --check
git diff --check
```

Las pruebas de servicio simulan Sheets, PropertiesService y LockService; cubren peticiones repetidas, gastos idénticos legítimos, fórmulas, validación y fallos entre escritura y confirmación. No sustituyen una validación sobre Google Sheets.

Para pruebas de navegador, servir la app en `127.0.0.1:8765` y ejecutar `node tests/browser.cjs` con Playwright disponible. Se puede indicar `PLAYWRIGHT_MODULE` con la ruta de una instalación temporal y `CHROME_PATH` con un ejecutable de Chrome. Todas las llamadas externas se interceptan; no se modifican datos reales. No es una dependencia de producción.

## Reintentos y límites

El navegador conserva el identificador de cada envío sin confirmar en `localStorage`. Reintroducir los mismos datos en el mismo navegador y destino reintenta ese envío. Tras una confirmación, otro guardado genera un identificador nuevo. No borrar el almacenamiento ni cambiar de navegador para reintentar sin comprobar antes la hoja.

El servicio conserva recibos durante siete días y rechaza identificadores anteriores, evitando que un recibo eliminado pueda volver a sumarse. Un pendiente caducado o con la celda modificada requiere revisión manual de Sheets antes de decidir cómo continuar. El reloj del dispositivo debe ser correcto. El bloqueo coordina ejecuciones del mismo proyecto de Apps Script; no impide ediciones manuales ni escrituras de otros proyectos.

## Contexto técnico

Consultar [docs/CONTEXTO.md](docs/CONTEXTO.md) antes de modificar la aplicación. Esta corrección se desarrolla directamente en `main` por autorización explícita del usuario del 13 de noviembre de 2026.
