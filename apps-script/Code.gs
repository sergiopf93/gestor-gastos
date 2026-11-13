const GASTOS = {
  'Compra':       16,
  'Gasolina':     26,
  'Restaurantes': 41,
  'Farmacia':     33,
};

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
               'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function doGet(e) {
  try {
    const accion = e.parameter.accion;
    if (accion === 'estado') return resp({ ok: true, gastosIdempotentes: true });
    if (accion === 'reporte')   return generarReporte();
    if (accion === 'nuevo_anio') return generarNuevoAnio();
    return guardarGasto(e.parameter);
  } catch (error) {
    return resp({ ok: false, error: error.message });
  }
}

function guardarGasto(p) {
  const mes = p.mes;
  const gasto = p.gasto;
  const dia = Number(p.dia);
  const valor = Number(p.valor);
  const id = p.id || '';
  const semana = 7 * 24 * 60 * 60 * 1000;
  const ahora = Date.now();
  const fechaId = Number(id.split('-')[0]);
  if (!/^\d{13}-[0-9a-f-]{36}$/i.test(id)) {
    return resp({ ok: false, error: 'Actualiza la aplicación antes de guardar el gasto' });
  }
  // Los IDs vencidos se rechazan: nunca se vuelven a tratar como gastos nuevos.
  if (ahora - fechaId > semana || fechaId > ahora + 300000) {
    return resp({ ok: false, error: 'Envío caducado o reloj incorrecto. Revisa el gasto en Sheets antes de continuar' });
  }
  if (!MESES.includes(mes) || !Object.prototype.hasOwnProperty.call(GASTOS, gasto) ||
      !Number.isInteger(dia) || dia < 1 || dia > 31 ||
      !/^\d+(\.\d{1,2})?$/.test(String(p.valor)) || !Number.isFinite(valor) || valor <= 0 ||
      !Number.isSafeInteger(Math.round(valor * 100))) {
    return resp({ ok: false, error: 'Datos del gasto no válidos' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(mes);
    if (!sheet) return resp({ ok: false, error: 'Pestaña no encontrada: ' + mes });
    const celda = sheet.getRange(GASTOS[gasto], dia + 3);
    const props = PropertiesService.getScriptProperties();
    const clave = 'gasto:' + id;
    const firma = JSON.stringify([ss.getId(), mes, gasto, dia, valor]);
    const guardado = props.getProperty(clave);
    let registro = guardado ? JSON.parse(guardado) : null;
    if (registro && registro.firma !== firma) {
      return resp({ ok: false, error: 'El identificador ya pertenece a otro gasto' });
    }
    if (registro && registro.estado === 'confirmado') {
      return resp({ ok: true, id, repetido: true });
    }

    if (!registro) {
      // Acotar el almacenamiento; un ID eliminado ya estará caducado y será rechazado.
      const propiedades = props.getProperties();
      Object.keys(propiedades).forEach(k => {
        if (k.startsWith('gasto:') && ahora - Number(k.slice(6).split('-')[0]) > semana) {
          props.deleteProperty(k);
        }
      });
      const actual = celda.getValue();
      const formula = celda.getFormula();
      if (actual !== '' && (typeof actual !== 'number' || !Number.isFinite(actual))) {
        return resp({ ok: false, error: 'La celda contiene un valor no numérico; revísala en Sheets' });
      }
      const base = formula ? '(' + formula.slice(1) + ')' : String(actual).replace('.', ',');
      registro = {
        firma, estado: 'pendiente', anterior: actual, formulaAnterior: formula,
        formula: formula || (actual !== '' && actual !== 0)
          ? '=' + base + '+' + String(valor).replace('.', ',') : '',
        valor
      };
      // Guardar el resultado previsto antes de escribir permite recuperar respuestas perdidas.
      props.setProperty(clave, JSON.stringify(registro));
    }

    const formulaActual = celda.getFormula();
    const valorActual = celda.getValue();
    const aplicado = registro.formula
      ? formulaActual === registro.formula
      : formulaActual === '' && valorActual === registro.valor;
    if (!aplicado) {
      if (formulaActual !== registro.formulaAnterior || valorActual !== registro.anterior) {
        return resp({ ok: false, error: 'La celda cambió durante un envío pendiente. Revisa el gasto en Sheets; no se ha vuelto a sumar' });
      }
      if (registro.formula) celda.setFormula(registro.formula);
      else celda.setValue(registro.valor);
      SpreadsheetApp.flush();
    }
    props.setProperty(clave, JSON.stringify({ firma, estado: 'confirmado' }));
    return resp({ ok: true, id });
  } finally {
    lock.releaseLock();
  }
}

function generarReporte() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const seg = ss.getSheetByName('Seguimiento ' + new Date().getFullYear());
  if (!seg) return resp({ ok: false, error: 'No se encontró la pestaña de seguimiento' });
  const verde = '#c6efce', rojo = '#ffc7ce';
  const verdeT = '#276221', rojoT = '#9c0006';
  const desviaciones = [];
  for (let i = 0; i < 58; i++) {
    const fila = i + 4;
    const categoria = seg.getRange(fila, 2).getValue();
    const grupo     = seg.getRange(fila, 1).getValue();
    const presup    = seg.getRange(fila, 3).getValue();
    const totalReal = seg.getRange(fila, 16).getValue();
    if (!categoria || presup === '' || presup === 0) continue;
    const presupAnual = presup * 12;
    const diferencia  = presupAnual - totalReal;
    const pct = presupAnual > 0 ? ((diferencia / presupAnual) * 100) : 0;
    if (Math.abs(diferencia) > 0.01 && totalReal > 0) {
      desviaciones.push({
        grupo: grupo || '', categoria,
        presupAnual: Math.round(presupAnual * 100) / 100,
        real: Math.round(totalReal * 100) / 100,
        diferencia: Math.round(diferencia * 100) / 100,
        pct: Math.round(pct * 10) / 10,
        ok: diferencia >= 0
      });
    }
  }
  const nombreRep = 'Reporte ' + new Date().getFullYear();
  let rep = ss.getSheetByName(nombreRep);
  if (rep) ss.deleteSheet(rep);
  rep = ss.insertSheet(nombreRep);
  rep.getRange(1,1,1,6).setValues([['Categoría','Grupo','Presup. Anual','Gasto Real','Diferencia','% Desv.']]);
  rep.getRange(1,1,1,6).setFontWeight('bold').setBackground('#1a7a3c').setFontColor('#ffffff');
  desviaciones.forEach((d, i) => {
    const f = i + 2;
    rep.getRange(f,1,1,6).setValues([[d.categoria,d.grupo,d.presupAnual,d.real,d.diferencia,d.pct+'%']]);
    rep.getRange(f,1,1,6).setBackground(d.ok ? verde : rojo).setFontColor(d.ok ? verdeT : rojoT);
  });
  rep.autoResizeColumns(1, 6);
  return resp({ ok: true, desviaciones });
}

function generarNuevoAnio() {
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const anoAct   = new Date().getFullYear();
  const anoNuevo = anoAct + 1;
  const nombre   = 'Presupuesto ' + anoNuevo;
  const file     = DriveApp.getFileById(ss.getId());
  const copia    = file.makeCopy(nombre, file.getParents().next());
  const ssNuevo  = SpreadsheetApp.openById(copia.getId());

  MESES.forEach(mes => {
    const sheet = ssNuevo.getSheetByName(mes);
    if (!sheet) return;

    // Leer todo el rango de golpe (filas 4-61, cols 4-34)
    const numFilas = 58, numCols = 31;
    const range    = sheet.getRange(4, 4, numFilas, numCols);
    const valores  = range.getValues();
    const formulas = range.getFormulas();

    // Construir nueva matriz: vaciar valores simples y fórmulas numéricas, mantener fórmulas con referencias
    const nuevos = valores.map((fila, ri) =>
      fila.map((val, ci) => {
        const f = formulas[ri][ci];
        if (f && f.startsWith('=') && f.match(/[A-Za-z]/)) return val; // fórmula con ref → mantener
        return ''; // valor o fórmula numérica → vaciar
      })
    );

    // Escribir todo de una vez
    range.setValues(nuevos);
  });

  const segViejo = ssNuevo.getSheetByName('Seguimiento ' + anoAct);
  if (segViejo) segViejo.setName('Seguimiento ' + anoNuevo);
  const repViejo = ssNuevo.getSheetByName('Reporte ' + anoAct);
  if (repViejo) ssNuevo.deleteSheet(repViejo);

  return resp({ ok: true, nombre, url: 'https://docs.google.com/spreadsheets/d/' + copia.getId() });
}

function resp(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
