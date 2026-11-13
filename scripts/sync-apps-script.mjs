import { readFileSync, writeFileSync } from 'node:fs';

const htmlPath = new URL('../index.html', import.meta.url);
const source = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8').trimEnd();
const html = readFileSync(htmlPath, 'utf8');
const start = html.indexOf('const APPS_SCRIPT_CODE = ');
const end = html.indexOf('\n\nasync function lanzarNuevoAno()', start);
if (start < 0 || end < 0) throw new Error('No se encontró el bloque de Apps Script');
const literal = '`' + source.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${') + '`';
const updated = html.slice(0, start) + 'const APPS_SCRIPT_CODE = ' + literal + ';' + html.slice(end);
if (process.argv.includes('--check')) {
  if (updated !== html) throw new Error('Ejecuta node scripts/sync-apps-script.mjs');
} else {
  writeFileSync(htmlPath, updated);
}
