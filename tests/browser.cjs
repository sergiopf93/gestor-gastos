const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const requests = [];
  const received = new Set();
  let total = 0;
  let loseResponse = false;
  let delay = 0;
  let compatible = true;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname !== 'script.google.com') return route.abort();
    const params = Object.fromEntries(url.searchParams);
    if (params.accion === 'estado') return route.fulfill({ json: compatible ? { ok: true, gastosIdempotentes: true } : { ok: true } });
    if (params.accion === 'reporte') return route.fulfill({ json: { ok: true, desviaciones: [] } });
    requests.push(params);
    if (!received.has(params.id)) { total += Number(params.valor); received.add(params.id); }
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (loseResponse) { loseResponse = false; return route.abort('failed'); }
    return route.fulfill({ json: { ok: true, id: params.id } });
  });
  await page.goto('http://127.0.0.1:8765');
  assert.equal(await page.locator('.tipo-pill.selected').count(), 1);
  await page.locator('#importe').fill('12,50');
  delay = 150;
  await page.evaluate(() => Promise.all([enviarGasto(), enviarGasto()]));
  assert.equal(requests.length, 1); assert.equal(total, 12.5);
  assert.equal(await page.locator('.historial-item').count(), 1);
  assert.equal(await page.locator('#importe').inputValue(), '');
  console.log('PASS: llamadas simultáneas generan una sola petición y una confirmación');

  await page.locator('#importe').fill('12,50');
  await page.evaluate(() => enviarGasto());
  assert.equal(total, 25); assert.notEqual(requests[0].id, requests[1].id);
  console.log('PASS: dos gastos legítimos iguales tienen IDs distintos y se suman');

  await page.locator('#importe').fill('9,25');
  loseResponse = true;
  await page.evaluate(() => enviarGasto());
  assert.equal(total, 34.25);
  const failedId = requests.at(-1).id;
  assert.match(await page.locator('#toast').textContent(), /Sin confirmación/);
  await page.reload();
  await page.locator('#importe').fill('9,25');
  await page.evaluate(() => enviarGasto());
  assert.equal(requests.at(-1).id, failedId); assert.equal(total, 34.25);
  console.log('PASS: respuesta perdida y recarga reutilizan el ID sin duplicar el total');

  const count = requests.length;
  for (const invalid of ['12abc', '1.234', 'Infinity', '-2', '0']) {
    await page.locator('#importe').fill(invalid);
    await page.evaluate(() => enviarGasto());
  }
  assert.equal(requests.length, count);
  console.log('PASS: importes inválidos no llegan al servicio');

  await page.locator('#importe').fill('7');
  await page.evaluate(() => { window.inflight = enviarGasto(); selectTipo('Farmacia'); document.getElementById('importe').value = '99'; });
  await page.evaluate(() => window.inflight);
  assert.equal(requests.at(-1).gasto, 'Compra');
  assert.equal(await page.locator('#importe').inputValue(), '99');
  assert.match(await page.locator('#s-detail').textContent(), /Compra/);
  console.log('PASS: cambiar el formulario durante el envío no altera el gasto ni borra el nuevo importe');

  await page.evaluate(() => lanzarReporte());
  assert.equal(await page.locator('#reporte-overlay.open').count(), 1);
  await page.evaluate(() => { cerrarReporte(); openDatePicker(); dpNav(-1); pickDay(5); abrirConfig(); });
  assert.equal(await page.locator('#config-overlay.open').count(), 1);
  assert.match(await page.locator('#fecha-display').textContent(), /5 de/);
  assert.deepEqual(errors, []);
  console.log('PASS: calendario, configuración y reporte siguen operativos; sin errores JavaScript');
  compatible = false;
  await page.reload();
  const beforeOldBackend = requests.length;
  await page.locator('#importe').fill('5');
  await page.evaluate(() => enviarGasto());
  assert.equal(requests.length, beforeOldBackend);
  assert.match(await page.locator('#toast').textContent(), /Actualiza el Apps Script/);
  console.log('PASS: un Apps Script antiguo se detecta antes de enviar cualquier gasto');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
