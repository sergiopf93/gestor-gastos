import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';

const source = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const id = () => Date.now() + '-' + randomUUID();

function backend(initial = '') {
  let value = initial;
  let formula = '';
  let locked = false;
  let writes = 0;
  let failConfirmation = false;
  let failFlush = false;
  const properties = new Map();
  const cell = {
    getValue: () => value,
    getFormula: () => formula,
    setValue(v) { assert.ok(locked); value = v; formula = ''; writes++; },
    setFormula(f) {
      assert.ok(locked); formula = f;
      value = Function('return ' + f.slice(1).replaceAll(',', '.'))();
      writes++;
    }
  };
  const context = vm.createContext({
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getId: () => 'test-sheet',
        getSheetByName: () => ({ getRange: () => cell })
      }),
      flush() { if (failFlush) { failFlush = false; throw new Error('Flush interrumpido'); } }
    },
    LockService: { getScriptLock: () => ({
      waitLock() { assert.equal(locked, false); locked = true; },
      releaseLock() { assert.ok(locked); locked = false; }
    }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => properties.get(k) ?? null,
      setProperty(k, v) {
        if (failConfirmation && JSON.parse(v).estado === 'confirmado') {
          failConfirmation = false; throw new Error('Confirmación interrumpida');
        }
        properties.set(k, v);
      },
      getProperties: () => Object.fromEntries(properties),
      deleteProperty: k => properties.delete(k)
    }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: text => ({ setMimeType: () => JSON.parse(text) })
    }
  });
  vm.runInContext(source, context);
  return {
    send(p = {}) {
      const result = context.doGet({ parameter: { mes: 'Noviembre', gasto: 'Compra', dia: '13', valor: '12.5', id: id(), ...p } });
      assert.equal(locked, false, 'El bloqueo debe liberarse incluso tras un error');
      return result;
    },
    get value() { return value; }, get formula() { return formula; }, get writes() { return writes; },
    setFormula(f) { locked = true; cell.setFormula(f); locked = false; },
    interruptConfirmation() { failConfirmation = true; },
    interruptFlush() { failFlush = true; },
    properties
  };
}

test('Un gasto en celda vacía se guarda como valor único y su repetición no lo duplica', () => {
  const b = backend(); const request = { id: id() };
  assert.equal(b.send(request).ok, true);
  assert.equal(b.send(request).repetido, true);
  assert.equal(b.value, 12.5); assert.equal(b.formula, ''); assert.equal(b.writes, 1);
});

test('La comprobación de compatibilidad no escribe en Sheets', () => {
  const b = backend();
  assert.equal(b.send({ accion: 'estado' }).gastosIdempotentes, true);
  assert.equal(b.writes, 0);
});

test('Dos gastos intencionados iguales se suman; repetir cualquiera no modifica el total', () => {
  const b = backend(); const first = { id: id() }; const second = { id: id() };
  b.send(first); b.send(second); b.send(first); b.send(second);
  assert.equal(b.value, 25); assert.equal(b.writes, 2);
});

test('Se conservan sumas anteriores, decimales y precedencia de fórmulas existentes', () => {
  const b = backend(); b.setFormula('=10+2*3');
  assert.equal(b.send().ok, true);
  assert.equal(b.formula, '=(10+2*3)+12,5'); assert.equal(b.value, 28.5);
});

test('Un reintento recupera una escritura cuya confirmación falló, sin volver a sumar', () => {
  for (const initial of ['', 20]) {
    const b = backend(initial); const request = { id: id() };
    b.interruptConfirmation(); assert.equal(b.send(request).ok, false);
    assert.equal(b.send(request).ok, true);
    assert.equal(b.value, (initial || 0) + 12.5); assert.equal(b.writes, 1);
  }
});

test('Un fallo tras escribir y antes de terminar flush tampoco duplica el gasto', () => {
  const b = backend(); const request = { id: id() };
  b.interruptFlush(); assert.equal(b.send(request).ok, false);
  assert.equal(b.send(request).ok, true); assert.equal(b.writes, 1);
});

test('Un envío pendiente cuya celda cambió se rechaza sin sumar de nuevo', () => {
  const b = backend(); const request = { id: id() };
  b.interruptConfirmation(); b.send(request); b.send();
  assert.equal(b.send(request).ok, false); assert.equal(b.value, 25); assert.equal(b.writes, 2);
});

test('No permite reutilizar un identificador para otro importe', () => {
  const b = backend(); const request = { id: id() }; b.send(request);
  assert.equal(b.send({ ...request, valor: '15' }).ok, false); assert.equal(b.value, 12.5);
});

test('Rechaza parámetros inválidos y celdas de texto sin escribir', () => {
  for (const p of [{ id: '' }, { valor: '12abc' }, { valor: 'Infinity' }, { valor: '0' },
    { valor: '-2' }, { valor: '1.234' }, { dia: '32' }, { dia: '2x' }, { gasto: 'toString' }, { mes: 'Otro' }]) {
    const b = backend(); assert.equal(b.send(p).ok, false); assert.equal(b.writes, 0);
  }
  const b = backend('Revisar'); assert.equal(b.send().ok, false); assert.equal(b.writes, 0);
});

test('Limpia recibos antiguos, conserva otras propiedades y rechaza IDs caducados', () => {
  const b = backend(); const old = (Date.now() - 8 * 86400000) + '-' + randomUUID();
  b.properties.set('gasto:' + old, '{}'); b.properties.set('config', 'conservar');
  b.send(); assert.equal(b.properties.has('gasto:' + old), false);
  assert.equal(b.properties.get('config'), 'conservar');
  assert.equal(b.send({ id: old }).ok, false); assert.equal(b.writes, 1);
});

test('El código Apps Script ofrecido para copiar coincide con su fuente', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const embedded = html.slice(html.indexOf('const APPS_SCRIPT_CODE = '), html.indexOf('\n\nasync function lanzarNuevoAno()'));
  assert.equal(vm.runInNewContext(embedded + '\nAPPS_SCRIPT_CODE'), source.trimEnd());
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
});

test('La URL nueva se usa por defecto, migra la antigua y conserva destinos personalizados', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const anterior = 'https://script.google.com/macros/s/AKfycbwcJ4kn-g1DhNnNdnQVBR1RfaDweKhMU0j8WCDZ6WS-r13laM_OrLmFSE_kUdt22ksG/exec';
  const actual = 'https://script.google.com/macros/s/AKfycbxWL8Gt9v_ZTVl-KYH4rvpRsX7ceaCxzQTjgbaJG9Z1pS7FK3tDGHiZwGyWui9pvnDV/exec';
  for (const saved of [null, anterior, 'https://script.google.com/macros/s/personalizado/exec']) {
    const storage = new Map(saved ? [['gastos_script_url', saved]] : []);
    const context = vm.createContext({
      window: { addEventListener() {} },
      localStorage: { getItem: k => storage.get(k) ?? null, removeItem: k => storage.delete(k) }
    });
    vm.runInContext(script, context);
    assert.equal(context.getURL(), saved && saved !== anterior ? saved : actual);
    assert.equal(storage.get('gastos_script_url'), saved && saved !== anterior ? saved : undefined);
  }
});
