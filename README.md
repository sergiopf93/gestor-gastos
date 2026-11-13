# Gestor de gastos

Aplicación web estática en español para registrar gastos en Google Sheets a través de Google Apps Script. La interfaz y el código de Apps Script que se ofrece para copiar están en `index.html`.

## Uso y desarrollo

No requiere instalación, compilación ni dependencias de Node. Para servirla localmente:

```sh
python3 -m http.server 8000
```

Abrir `http://localhost:8000`. Las operaciones reales usan la URL de Apps Script configurada en el navegador y pueden modificar la hoja de cálculo. Para pruebas, utilizar una copia y una implementación de pruebas.

## Contexto técnico

Consultar [docs/CONTEXTO.md](docs/CONTEXTO.md) antes de modificar la aplicación. Los cambios se preparan en ramas de desarrollo; `main` requiere validación y autorización explícita para integrar.
