(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); }
  function fmtN(v, d) { if (v == null || isNaN(v)) return '—'; return v.toLocaleString('pt-BR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function parseNum(s, pdf) {
    s = String(s == null ? '' : s).trim(); if (!s) return null;
    if (s.indexOf(',') >= 0) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    if (pdf && /^\d{1,3}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, ''));
    var v = parseFloat(s); return isNaN(v) ? null : v;
  }
  function dkey(d, m, y) { return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2); }
  function dmy(s) { var m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s || ''); return m ? dkey(+m[1], +m[2], m[3]) : null; }
  function showD(k) { if (!k) return '—'; var p = k.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  var CERT_RE = /\b([A-Z0-9]{2})\s?-\s?(\d{8})\s?\/\s?([A-Z0-9]{2,5}(?:-[A-Z]{2,4})?)\s?\/\s?(\d{2})\b/g;
  function certKey(s) { var m = /(\d{8})/.exec(String(s || '').replace(/\s/g, '')); return m ? m[1] : String(s || '').replace(/\D/g, ''); }
  function fixPrefix(p) { p = norm(p).replace(/^1O|^IO|^10|^LO|^L0/, 'I0').replace(/^NO/, 'N0'); return p; }

  /* ---------- tema ---------- */
  (function () {
    var root = document.documentElement, saved = null;
    try { saved = localStorage.getItem('hub-tema'); } catch (e) {}
    function apply(t) {
      if (t) root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
      var dark = t ? t === 'dark' : window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-dark', dark ? '1' : '0');
    }
    apply(saved);
    $('theme').onclick = function () { var dark = root.getAttribute('data-dark') === '1', t = dark ? 'light' : 'dark'; apply(t); try { localStorage.setItem('hub-tema', t); } catch (e) {} };
  })();

  /* ---------- pdf.js e OCR (tudo embutido, sem rede) ---------- */
  try {
    var wurl0 = URL.createObjectURL(new Blob([$('pdfworker').textContent], { type: 'text/javascript' }));
    pdfjsLib.GlobalWorkerOptions.workerSrc = wurl0;
    try { pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(wurl0); } catch (e) {}
  } catch (e) {}

  var OCR = (function () {
    var wk = null, starting = null;
    function get() {
      if (wk) return Promise.resolve(wk);
      if (starting) return starting;
      starting = (async function () {
        var guard = ";var _d=function(s){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;};" +
          "var _f=self.fetch;self.fetch=function(u,o){u=String(u);for(var k in self.__TL){if(u.indexOf('/'+k+'.traineddata')>=0){return Promise.resolve(new Response(_d(self.__TL[k])));}}" +
          "if(u.indexOf('data:')===0&&_f)return _f(u,o);return Promise.reject(new Error('Rede bloqueada'));};\n";
        var wurl = URL.createObjectURL(new Blob([$('ocr-lang').textContent, guard, $('ocr-core').textContent, '\n;if(typeof TesseractCore==="undefined"&&typeof TesseractCoreWASM!=="undefined")self.TesseractCore=TesseractCoreWASM;\n', $('ocr-worker').textContent], { type: 'text/javascript' }));
        wk = await Tesseract.createWorker('por', 1, { workerPath: wurl, workerBlobURL: false, corePath: 'https://ocr.local/core.js', langPath: 'https://ocr.local/lang', cacheMethod: 'none', gzip: true });
        return wk;
      })();
      var p = starting; p.then(function () { starting = null; }, function () { starting = null; wk = null; }); return p;
    }
    async function page(pg) {
      var w = await get();
      var vp1 = pg.getViewport({ scale: 1 }), sc = Math.min(300 / 72, 3600 / Math.max(vp1.width, vp1.height)), vp = pg.getViewport({ scale: sc });
      var c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: x, viewport: vp }).promise;
      // apaga linhas longas (bordas de tabela) para o OCR enxergar o texto das células
      if (window.__LR) try { var W = c.width, H = c.height, id = x.getImageData(0, 0, W, H), d = id.data, minH = Math.round(0.12 * W), minV = Math.round(16 * sc), i, k, run;
        var dk = function (p) { return d[p] + d[p + 1] + d[p + 2] < 380; };
        for (var yy = 0; yy < H; yy++) { run = 0; for (var xx = 0; xx <= W; xx++) { if (xx < W && dk((yy * W + xx) * 4)) run++; else { if (run >= minH) for (k = xx - run; k < xx; k++) { i = (yy * W + k) * 4; d[i] = d[i + 1] = d[i + 2] = 255; } run = 0; } } }
        for (var xx2 = 0; xx2 < W; xx2++) { run = 0; for (var yy2 = 0; yy2 <= H; yy2++) { if (yy2 < H && dk((yy2 * W + xx2) * 4)) run++; else { if (run >= minV) for (k = yy2 - run; k < yy2; k++) { i = (k * W + xx2) * 4; d[i] = d[i + 1] = d[i + 2] = 255; } run = 0; } } }
        x.putImageData(id, 0, 0); } catch (e) {}
      var r = await w.recognize(c, {}, { blocks: true, text: false });
      c.width = c.height = 0;
      var out = [];
      (r.data.blocks || []).forEach(function (b) { (b.paragraphs || []).forEach(function (p) { (p.lines || []).forEach(function (ln) {
        (ln.words || []).forEach(function (wd) {
          var t = (wd.text || '').trim().replace(/^[|=—_~¦]+|[|=—_~¦]+$/g, ''); if (!t || (wd.confidence < 15 && !/\d{4}/.test(t)) || /^[\-–—.,:;'"`´^]+$/.test(t)) return;
          var bb = wd.bbox; out.push({ str: t, x0: bb.x0 / sc, x1: bb.x1 / sc, y0: bb.y0 / sc, y1: bb.y1 / sc, conf: wd.confidence });
        });
      }); }); });
      return out;
    }
    return { page: page };
  })();

  /* ---------- leitura dos arquivos ---------- */
  function toLines(words) {
    var ws = words.filter(function (w) { return w.str && w.str.trim(); }).map(function (w) { w.yc = (w.y0 + w.y1) / 2; w.h = Math.max(1, w.y1 - w.y0); return w; });
    ws.sort(function (a, b) { return a.yc - b.yc || a.x0 - b.x0; });
    var lines = [];
    ws.forEach(function (w) {
      var L = lines.length ? lines[lines.length - 1] : null;
      if (L && Math.abs(w.yc - L.yc) < 0.5 * Math.max(w.h, L.h)) { L.words.push(w); L.yc = (L.yc * (L.words.length - 1) + w.yc) / L.words.length; L.h = Math.max(L.h, w.h); }
      else lines.push({ yc: w.yc, h: w.h, words: [w] });
    });
    lines.forEach(function (L) { L.words.sort(function (a, b) { return a.x0 - b.x0; }); L.text = L.words.map(function (w) { return w.str.trim(); }).join(' '); L.y0 = Math.min.apply(null, L.words.map(function (w) { return w.y0; })); L.y1 = Math.max.apply(null, L.words.map(function (w) { return w.y1; })); });
    return lines;
  }

  async function readPdf(f, onProg, force) {
    var buf = new Uint8Array(await f.file.arrayBuffer());
    var doc = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
    var pages = [];
    for (var p = 1; p <= doc.numPages; p++) {
      var pg = await doc.getPage(p), vp = pg.getViewport({ scale: 1 });
      var tc = await pg.getTextContent(), words = [];
      tc.items.forEach(function (it) {
        if (!it.str || !it.str.trim()) return;
        var pt = vp.convertToViewportPoint(it.transform[4], it.transform[5]), h = Math.hypot(it.transform[2], it.transform[3]) || 8;
        words.push({ str: it.str, x0: pt[0], x1: pt[0] + it.width, y0: pt[1] - h, y1: pt[1] });
      });
      var chars = words.reduce(function (s, w) { return s + w.str.replace(/\s/g, '').length; }, 0), ocr = false;
      if (force || chars < 40) { onProg((p - 1) / doc.numPages, 'Lendo página ' + p + ' de ' + doc.numPages + ' com OCR'); words = await OCR.page(pg); ocr = true; }
      pages.push({ n: p, w: vp.width, h: vp.height, ocr: ocr, lines: toLines(words), words: words });
      onProg(p / doc.numPages, 'Página ' + p + ' de ' + doc.numPages);
    }
    return pages;
  }

  async function readXlsx(f) {
    var zip = await JSZip.loadAsync(await f.file.arrayBuffer());
    var txt = async function (p) { var e = zip.file(p); return e ? await e.async('string') : ''; };
    var dp = new DOMParser();
    var sst = [], sx = dp.parseFromString(await txt('xl/sharedStrings.xml') || '<a/>', 'application/xml');
    Array.prototype.forEach.call(sx.getElementsByTagName('si'), function (si) { sst.push(Array.prototype.map.call(si.getElementsByTagName('t'), function (t) { return t.textContent; }).join('')); });
    // estilos de data
    var dateXf = {}, st = dp.parseFromString(await txt('xl/styles.xml') || '<a/>', 'application/xml'), custom = {};
    Array.prototype.forEach.call(st.getElementsByTagName('numFmt'), function (n) { custom[n.getAttribute('numFmtId')] = n.getAttribute('formatCode') || ''; });
    var xfs = st.getElementsByTagName('cellXfs')[0];
    if (xfs) Array.prototype.forEach.call(xfs.getElementsByTagName('xf'), function (xf, i) { var id = +xf.getAttribute('numFmtId'); if ((id >= 14 && id <= 22) || /[dy]/i.test((custom[id] || '').replace(/"[^"]*"/g, ''))) dateXf[i] = 1; });
    var wb = dp.parseFromString(await txt('xl/workbook.xml'), 'application/xml'), rels = dp.parseFromString(await txt('xl/_rels/workbook.xml.rels'), 'application/xml');
    var sh = wb.getElementsByTagName('sheet')[0], rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'), target = 'worksheets/sheet1.xml';
    Array.prototype.forEach.call(rels.getElementsByTagName('Relationship'), function (r) { if (r.getAttribute('Id') === rid) target = r.getAttribute('Target'); });
    target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
    var ws = dp.parseFromString(await txt('xl/' + target), 'application/xml'), lines = [];
    Array.prototype.forEach.call(ws.getElementsByTagName('row'), function (row) {
      var cells = [];
      Array.prototype.forEach.call(row.getElementsByTagName('c'), function (c) {
        var t = c.getAttribute('t'), s = c.getAttribute('s'), v = c.getElementsByTagName('v')[0], val = v ? v.textContent : '';
        if (t === 's') val = sst[+val] || ''; else if (t === 'inlineStr') val = Array.prototype.map.call(c.getElementsByTagName('t'), function (x) { return x.textContent; }).join('');
        else if (val !== '' && s != null && dateXf[s] && t !== 'str') { var d = new Date(Math.round((+val - 25569) * 86400000)); val = ('0' + d.getUTCDate()).slice(-2) + '/' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '/' + d.getUTCFullYear(); }
        val = String(val).trim(); if (val) cells.push(val);
      });
      if (cells.length) lines.push({ text: cells.join(' '), words: [] });
    });
    return [{ n: 1, ocr: false, lines: lines, words: [] }];
  }

  function classify(text) {
    var U = norm(text);
    if (/ESTABELECIMENTO NACIONAL/.test(U) && /PRODUTOS HABILITADOS/.test(U)) return 'ficha';
    if (/PSCF\s*7446|ORDEM CARREGAMENTO/.test(U)) return 'pscf';
    if (/ANEXO IV/.test(U) && /RELATORIO DE CARGA/.test(U)) return 'anexo4';
    if (/CERTIFICADO SANITARIO NACIONAL/.test(U)) return 'csn';
    if (/DECLARACAO DE CONFORMIDADE|DCPOA/.test(U.slice(0, 1500))) return 'dcpoa';
    if (/CERTIFICADO SANITARIO|CERTIFICADO ZOOSANITARIO|HEALTH CERTIFICATE|CERTIFICADO SANITARIO PARA EXPORTA/.test(U)) return 'csi';
    if (/SIGSIF/.test(U.slice(0, 1500))) return 'sigsif';
    return 'outro';
  }
  var TYPES = { pscf: 'Relatório PSCF 7446', anexo4: 'Anexo IV', csn: 'CSN', csi: 'CSI', dcpoa: 'DCPOA', sigsif: 'SIGSIF', ficha: 'Ficha do SIF', outro: 'Não reconhecido' };
  function numPadrao(n) { n = String(n).trim(); return /^[NI]\d-\d{8}\/[A-Z0-9]+(?:-[A-Z]+)?\/\d{2}$/.test(n) || /^\d{6}\/\d{2,5}\/\d{2}$/.test(n); }
  function tipoNum(n) { n = norm(n).trim(); return /^N\d-/.test(n) ? 'csn' : /^I\d-/.test(n) ? 'csi' : 'dcpoa'; }
  function isResp(t) { return t === 'csn' || t === 'csi' || t === 'dcpoa' || t === 'sigsif'; }

  /* ---------- lotes: junta pedaços quebrados na célula ---------- */
  function digitize(s) {
    var d = (s.match(/\d/g) || []).length, a = s.replace(/[;,.\-\/\s]/g, '').length;
    if (a && d / a >= 0.6) s = s.replace(/[Oo]/g, '0').replace(/[lI|i!]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2');
    return s;
  }
  function lotsFrom(str, set) {
    String(str).split(/[^0-9]+/).forEach(function (t) {
      if (t.length === 8) set.add(t);
      else if (t.length > 8 && t.length % 8 === 0) for (var i = 0; i < t.length; i += 8) set.add(t.substr(i, 8));
    });
  }
  function extractLots(words) {
    var set = new Set();
    // junta palavras coladas na mesma linha (o OCR às vezes parte um lote em dois)
    var segs = [];
    toLines(words.map(function (w) { return { str: w.str, x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1 }; })).forEach(function (l) { var cur = null;
      l.words.forEach(function (w) { var s = digitize(w.str.replace(/\s/g, '')), h = w.y1 - w.y0;
        if (cur && w.x0 - cur.x1 < 0.6 * h && /[\d;:]$/.test(cur.s) && /^[\d;:]/.test(s)) { cur.s += s; cur.x1 = w.x1; } else { cur = { s: s, x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1 }; segs.push(cur); } }); });
    var cand = segs.filter(function (w) { return /\d{2}/.test(w.s); });
    cand.forEach(function (w) { lotsFrom(w.s, set); });
    // agrupa por coluna (mesma margem esquerda) e junta linhas seguidas
    var cols = [];
    cand.sort(function (a, b) { return a.x0 - b.x0; }).forEach(function (w) { var c = cols.find(function (c) { return Math.abs(c.x - w.x0) < 7; }); if (c) c.ws.push(w); else cols.push({ x: w.x0, ws: [w] }); });
    cols.forEach(function (c) {
      c.ws.sort(function (a, b) { return a.y0 - b.y0; });
      var acc = '', prev = null;
      c.ws.forEach(function (w) {
        var h = w.y1 - w.y0;
        if (prev && w.y0 - prev.y1 < 1.3 * h && /[\d;:]$/.test(prev.s) && /^[\d;:]/.test(w.s) && w.s.indexOf('/') < 0 && prev.s.indexOf('/') < 0) acc += w.s; else acc += ' ' + w.s;
        prev = w;
      });
      lotsFrom(acc, set);
    });
    return set;
  }
  function parseDates(s) {
    s = digitize(s);
    var out = { set: new Set(), ranges: [], months: new Set() }, m, re = /((?:\d{1,2}\s*,\s*)*\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/g, last = null;
    while ((m = re.exec(s))) {
      var mo = +m[2], y = m[3], days = m[1].split(/\s*,\s*/);
      var between = last ? norm(s.slice(last.end, m.index)).trim() : '';
      var keys = days.map(function (d) { return dkey(+d, mo, y); });
      if (last && days.length === 1 && last.single && /^(A|ATE|HASTA|AO)$/.test(between)) { out.ranges.push([last.key, keys[0]]); }
      keys.forEach(function (k) { out.set.add(k); });
      last = { end: m.index + m[0].length, single: days.length === 1, key: keys[keys.length - 1] };
    }
    var rest = s.replace(re, ' '), r2 = /(?:^|[^\d\/])(\d{2})\s*\/\s*(\d{4})(?!\d)/g;
    while ((m = r2.exec(rest))) out.months.add(m[2] + '-' + m[1]);
    return out;
  }
  function inDates(k, D) {
    if (!k) return null; if (!D.set.size && !D.ranges.length) return null;
    if (D.set.has(k)) return true;
    return D.ranges.some(function (r) { return k >= r[0] && k <= r[1]; });
  }
  var STOP = { DE: 1, DA: 1, DO: 1, E: 1, Y: 1, EM: 1, COM: 1 };
  function nameTokens(s) { return norm(s).replace(/\d{3,4}\s*\/\s*\d{2,5}/g, ' ').replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(function (t) { return t && t.length > 1 && !STOP[t] && !/^\d+$/.test(t); }); }
  function nameScore(a, b) { var A = nameTokens(a), B = new Set(nameTokens(b)); if (!A.length) return 0; return A.filter(function (t) { return B.has(t); }).length / A.length; }
  function countries(s) { return norm(s).split(/[|,;\/]| E /).map(function (x) { return x.replace(/[^A-Z ]/g, '').trim(); }).filter(function (x) { return x.length > 2; }); }

  /* ---------- PSCF ---------- */
  function parsePSCF(pages, pdf) {
    var R = { destino: '', ref: '', oc: '', mercado: '', lines: [], resumo: [], habil: {} }, sec = 'cab', prod = null, sif = null;
    var DET = /(?:([A-Z0-9][A-Z0-9.\/-]*\d[A-Z0-9.\/-]*)\s+)?(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(\d{6,10})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+(\d+)\s+(\d{3,4}\/\d{2,5})\s*(.*)$/;
    var RES = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(\d{6,10})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*$/;
    pages.forEach(function (pg) { pg.lines.forEach(function (L) {
      var t = L.text, U = norm(t), m;
      if ((m = /DESTINO\s*:\s*([A-Z ]+?)(?:\s+PLACA|\s*$)/.exec(U)) && !R.destino) R.destino = m[1].trim();
      if ((m = /REFERENCIA\s*:\s*(.+?)(?:\s+PLACA|$)/.exec(U)) && !R.ref) R.ref = m[1].trim();
      if ((m = /O\.C\.?\s*:\s*(\d+)/.exec(U)) && !R.oc) R.oc = m[1];
      if ((m = /TIPO MERCADO\s*:\s*(.+?)(?:\s+CONTAINER|$)/.exec(U)) && !R.mercado) R.mercado = m[1].trim();
      if (/^RESUMO ITEM/.test(U)) { sec = 'res'; return; }
      if (/^HABILITACOES DA CARGA/.test(U)) { sec = 'hab'; return; }
      if (/^ITEM\s+NR\.?\s*SIF/.test(U) || /^ITEM\s+DESCRICAO/.test(U)) { if (sec === 'cab') sec = 'det'; return; }
      if (sec === 'res' && (m = /^(\d{5,8})\s+(.+?)\s+(\d{3,5})$/.exec(U))) { prod = { code: m[1], desc: t.replace(/^\s*\d+\s+/, '').replace(/\s+\d+\s*$/, '').trim() }; sif = m[3]; return; }
      if ((m = /^(\d{5,8})\s+([A-Z][A-Z0-9 ().,\/-]{5,})$/.exec(U))) { prod = { code: m[1], desc: t.replace(/^\s*\d+\s+/, '').trim() }; if (sec === 'cab') sec = 'det'; return; }
      if ((m = /^NR\.?\s*SIF\s+(\d+)/.exec(U))) { sif = m[1]; return; }
      if (sec === 'res' && (m = /^(\d{3,5})(?:\s|$)/.exec(U)) && !/\//.test(U)) { sif = m[1]; }
      if (sec === 'res' && (m = /^(\d{5,8})\s+(.+?)\s+(\d{3,5})$/.exec(U))) { prod = { code: m[1], desc: t.replace(/^\s*\d+\s+/, '').replace(/\s+\d+\s*$/, '').trim() }; sif = m[3]; return; }
      if (sec === 'det' && (m = DET.exec(t))) {
        R.lines.push({ prod: prod, sif: sif, cert: m[1] ? m[1] : '', key: m[1] ? certKey(m[1]) : '', dtAbate: dmy(m[2]), dtProd: dmy(m[4]), dtVal: dmy(m[5]), turno: m[6], lote: m[7],
          vol: parseNum(m[8], pdf), pl: parseNum(m[9], pdf), pb: parseNum(m[10], pdf), nf: m[11], rotulo: m[12], marca: (m[13] || '').trim() });
        return;
      }
      if (sec === 'res' && (m = RES.exec(t))) { R.resumo.push({ prod: prod, sif: sif, dtProd: dmy(m[1]), lote: m[4], vol: parseNum(m[5], pdf), pl: parseNum(m[6], pdf) }); return; }
      if (sec === 'hab' && (m = /^(\d{2,5})\s+(\d+)\s+([A-Z0-9][A-Z0-9.\/-]*\d[A-Z0-9.\/-]*)\s+(.+)$/.exec(U))) { R.habil[certKey(m[3])] = { sif: m[1], nf: m[2], cert: m[3], list: countries(m[4]), raw: m[4] }; }
    }); });
    if (R.lines.length) R.resumo = []; // o detalhe manda; o resumo do relatório só é usado se não houver detalhe
    if (!R.resumo.length) { // monta o resumo a partir das linhas
      var agg = {}; R.lines.forEach(function (l) { var k = l.sif + '|' + l.lote; agg[k] = agg[k] || { prod: l.prod, sif: l.sif, dtProd: l.dtProd, lote: l.lote, vol: 0, pl: 0 }; agg[k].vol += l.vol || 0; agg[k].pl += l.pl || 0; });
      R.resumo = Object.keys(agg).map(function (k) { return agg[k]; });
    }
    return R;
  }

  /* ---------- Anexo IV ---------- */
  function parseAnexo(pages) {
    var A = { sif: '', estab: '', embarque: '', destino: '', sigsif: '', dcpoa: '', numero: '', prods: [] }, cur = null, inTab = false, colX = null, prodSif = null;
    var ROW = /^(?:(\d{2,5})\s+)?(\d{8})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s*(.*?)\s*(\d+)\s+([\d.]+,\d{3})\s+([\d.]+,\d{3})\s*$/;
    pages.forEach(function (pg) { pg.lines.forEach(function (L) {
      var U = norm(L.text), m;
      if (!A.sif && (m = /^\s*2\.\s*SIF\s*:\s*(\d+)/.exec(U))) A.sif = m[1];
      if (!A.estab && (m = /^\s*1\.\s*ESTABELECIMENTO\s*:\s*(.+)$/.exec(U))) A.estab = m[1].trim();
      if (!A.embarque && (m = /RELATORIO DE EMBARQUE\s*:\s*(\d+)/.exec(U))) A.embarque = m[1];
      if (!A.destino && (m = /PAIS DE DESTINO\s*:\s*(.+)$/.exec(U))) A.destino = m[1].trim();
      if (!A.sigsif && (m = /REFERENCIA SIGSIF\s*:\s*(\S+)/.exec(U))) A.sigsif = m[1];
      if (!A.dcpoa && (m = /PROCESSO DCPOA\s*:?\s*(\S+)/.exec(U))) A.dcpoa = m[1];
      if (!A.numero && (m = /N[º°O]\s*([\d\s\/]+?)\s*,\s*EMITIDO EM\s*([\d\/]+)/.exec(U))) A.numero = m[1].replace(/\s/g, '') + ' (' + m[2] + ')';
      if (/^TABELA 01/.test(U)) { inTab = true; return; }
      if (/^TABELA 02|^12\.\s*ANALISES|^\(1\) INFORMAR/.test(U)) { inTab = false; cur = null; return; }
      if (!inTab) return;
      if (/N[º°O]?\s*CSN/.test(U) && /CSI/.test(U)) {
        colX = {}; L.words.forEach(function (w) { var n = norm(w.str); ['CSN', 'CSI', 'DCPOA'].forEach(function (k) { if (n.indexOf(k) >= 0 && colX[k] == null) colX[k] = (w.x0 + w.x1) / 2; }); });
      }
      if ((m = /^PRODUTO\s+(\d+)\s*:\s*(.*)$/.exec(U))) {
        cur = null; prodSif = null;
        if (!/^X{3}/.test(m[2].trim())) { cur = { n: m[1], nome: L.text.replace(/^.*?:\s*/, '').trim(), sif: '', lots: [], certs: [] }; A.prods.push(cur); }
        return;
      }
      if (!cur) return;
      // certificados nesta linha
      (L.words.length ? L.words : [{ str: L.text, x0: 0, x1: 0 }]).forEach(function (w) {
        var s = norm(w.str), mm; CERT_RE.lastIndex = 0;
        while ((mm = CERT_RE.exec(s))) {
          var num = fixPrefix(mm[1]) + '-' + mm[2] + '/' + mm[3] + '/' + mm[4], col = /^I/.test(num) ? 'CSI' : /^N/.test(num) ? 'CSN' : 'DCPOA';
          if (colX && w.x1) { var cx = (w.x0 + w.x1) / 2, best = null; Object.keys(colX).forEach(function (k) { if (best == null || Math.abs(colX[k] - cx) < Math.abs(colX[best] - cx)) best = k; }); col = best; }
          if (!cur.certs.some(function (c) { return c.key === mm[2]; })) cur.certs.push({ num: num, key: mm[2], col: col });
        }
      });
      if ((m = ROW.exec(L.text))) {
        if (m[1]) prodSif = m[1];
        if (!cur.sif && prodSif) cur.sif = prodSif;
        cur.lots.push({ sif: prodSif || cur.sif, lote: m[2], dtProd: dmy(m[3]), dtVal: dmy(m[4]), vol: parseNum(m[6], true), pb: parseNum(m[7], true), pl: parseNum(m[8], true) });
      }
    }); });
    return A;
  }

  /* ---------- documentos de respaldo ---------- */
  function findDestField(pages) {
    for (var p = 0; p < pages.length; p++) {
      var lines = pages[p].lines;
      for (var i = 0; i < lines.length; i++) {
        var ws = lines[i].words;
        for (var j = 0; j < ws.length; j++) {
          if (!/^PAIS/.test(norm(ws[j].str))) continue;
          var tail = ws.slice(j, j + 4).map(function (w) { return norm(w.str); }).join(' ');
          if (!/DESTIN/.test(tail)) continue;
          var ax = ws[j].x0, k = j; while (k < ws.length && !/DESTIN/.test(norm(ws[k].str))) k++;
          var same = [], q = k + 1; while (q < ws.length && !/^\d+(\.\d+)*\.?$/.test(ws[q].str) && !/CODIGO|ISO/.test(norm(ws[q].str))) { same.push(ws[q].str); q++; }
          var v = same.join(' ').replace(/^[:\s]+/, '').trim();
          if (/[A-Za-z]{3}/.test(v)) return v;
          for (var n = i + 1; n < Math.min(lines.length, i + 3); n++) {
            var below = lines[n].words.filter(function (w) { return w.x0 >= ax - 15 && w.x0 <= ax + 110; }).map(function (w) { return w.str; }).join(' ').trim();
            if (/[A-Za-z]{3}/.test(below)) return below;
          }
        }
      }
    }
    return '';
  }
  function cleanCountry(v) { return String(v || '').replace(/\s+[A-Z]{2}$/, '').trim(); }
  function parseRespaldo(pages, type) {
    var all = []; pages.forEach(function (pg) { pg.lines.forEach(function (L) { all.push(L.text); }); });
    var text = all.join('\n'), U = norm(text), flat = U.replace(/\s+/g, ' ');
    var D = { numero: '', key: '', rows: [], allLots: new Set(), habilDoc: [], habilItens: {}, destField: '', destSif: '', text: text };
    // número
    var freq = {}, first = {}, m; CERT_RE.lastIndex = 0;
    var Ud = digitize(U);
    while ((m = CERT_RE.exec(U))) { var k = m[2]; freq[k] = (freq[k] || 0) + 1; if (!first[k]) first[k] = fixPrefix(m[1]) + '-' + m[2] + '/' + m[3] + '/' + m[4]; }
    var best = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; })[0];
    if (best) { D.numero = first[best]; D.key = best; }
    else if ((m = /(?:DCPOA|DECLARACAO)[^\d]{0,40}(\d{3,8}\s?\/\s?\d{2,4}(?:\s?\/\s?\d{2,4})?)/.exec(Ud))) { D.numero = m[1].replace(/\s/g, ''); D.key = D.numero.replace(/\D/g, ''); }
    // habilitação por item (Observações do CSN) e do documento
    var re = /ITE(?:M|NS)\s+((?:\d{1,2}\.\d{1,2}\.?\s*(?:,|\bE\b)?\s*)+)\s*-?\s*HABILITA\w*\s*:?\s*([^;]+?)(?=;|\s+ITE(?:M|NS)\s+\d|\s+VERIFICAR|\s+NOME DO|$)/g;
    // Observações: habilitação por item ("ITEM 1.1, 1.2 HABILITAÇÃO: ...", "ITEM 1 FILIPINAS; ITEM 3 JAPÃO") ou geral
    var obs = (/OBSERVACOES\s*:?\s*(.*?)(?=\s+VERIFICAR EM|\s+CODIGO DE AUTENTICIDADE|\s+NOME DO MEDICO|$)/.exec(flat) || [])[1] || '';
    obs = obs.trim(); D.obs = obs;
    if (obs && !/^X+\.?$/.test(obs)) {
      var partes = obs.split(/\bITE(?:M|NS)\b/);
      partes.slice(1).forEach(function (pt) {
        var mm = /^[\s:.\-nº°]*((?:\d{1,2}(?:\.\d{1,2})?\.?\s*(?:,|\bE\b|\bA\b|\/|-)?\s*)+)(.*)$/.exec(pt); if (!mm) return;
        var nums = [], toks = mm[1].replace(/\.\s*$/, '').split(/\s*(?:,|\bE\b|\/)\s*/);
        toks.forEach(function (t) { var r = /^(\d{1,2}(?:\.\d{1,2})?)\s*(?:\bA\b|-)\s*(\d{1,2}(?:\.\d{1,2})?)$/.exec(t.trim());
          var lab = function (x) { x = x.replace(/\.$/, ''); return x.indexOf('.') >= 0 ? x : '1.' + x; };
          if (r) { var a = +lab(r[1]).split('.')[1], b = +lab(r[2]).split('.')[1]; for (var q = a; q <= b; q++) nums.push('1.' + q); }
          else if (/^\d/.test(t.trim())) nums.push(lab(t.trim())); });
        var txt = mm[2].replace(/^\s*-?\s*HABILITA\w*\s*:?\s*/, '').replace(/[;.\s]+$/, '').trim();
        if (txt) nums.forEach(function (it) { D.habilItens[it] = [txt]; });
      });
      if (partes.length === 1 && /HABILITA/.test(obs)) D.habilObs = [obs.replace(/^.*?HABILITA\w*\s*:?\s*/, '').replace(/[;.\s]+$/, '')];
    }
    if ((m = /ECONOMICO\(S\)\s*:\s*(.+?)\s+1\.\s*IDENTIFICA/.exec(flat))) D.habilDoc = countries(m[1]);
    D.destField = cleanCountry(findDestField(pages));
    if ((m = /DESTINATARIO.{0,140}?SIF\s*(\d{2,5})/.exec(flat))) D.destSif = m[1];
    // tabela de produtos
    pages.forEach(function (pg) {
      var L = pg.lines, hi = -1;
      for (var i = 0; i < L.length; i++) { var u = norm(L[i].text); if (/LOTE/.test(u) && /(PRODU|MARCA|VALIDADE|NOME|PESO)/.test(u)) { hi = i; break; } }
      if (hi < 0) return;
      var start = -1, end = L.length;
      for (var j = hi + 1; j < L.length; j++) { if (/\d{3,}|^X{3}|^\d\.\d/.test(norm(L[j].text))) { start = j; break; } }
      if (start < 0) return;
      for (var e = start; e < L.length; e++) { if (/(^|\s)TOTAL\b/.test(norm(L[e].text)) && e > start) { end = e; break; } }
      var hdrWords = []; for (var h = hi; h < start; h++) hdrWords = hdrWords.concat(L[h].words);
      var data = L.slice(start, end), tableLeft = Math.min.apply(null, data.map(function (l) { return l.words.length ? l.words[0].x0 : 9999; }));
      var cands = hdrWords.filter(function (w) { return /^(MARCA|LOTE|SIF|DATA|VALIDADE|QUANTIDADE)/.test(norm(w.str).replace(/^[^A-Z]+/, '')) && w.x0 > tableLeft + 60; });
      var hw = cands.sort(function (a, b) { return a.x0 - b.x0; })[0], nameR = hw ? hw.x0 - 4 : tableLeft + 0.3 * (pg.w || 600);
      if (hw) { // procura o vão entre a coluna do produto e a próxima
        var iv = []; data.forEach(function (l) { l.words.forEach(function (w) { if (w.x0 < hw.x1) iv.push([w.x0, Math.min(w.x1, w.x0 + 400)]); }); });
        iv.sort(function (a, b) { return a[0] - b[0]; }); var endX = null;
        for (var q = 0; q < iv.length; q++) { if (endX != null && iv[q][0] - endX >= 2 && iv[q][0] > tableLeft + 60) { nameR = iv[q][0] - 1; break; } endX = endX == null ? iv[q][1] : Math.max(endX, iv[q][1]); }
      }
      var rows = [], cur = null, prevY = null, lh = data.map(function (l) { return l.h; }).sort(function (a, b) { return a - b; })[Math.floor(data.length / 2)] || 8;
      data.forEach(function (l) {
        var left = l.words.filter(function (w) { return w.x0 < nameR; });
        if (left.length) {
          var lm = /^(\d{1,2}\.\d{1,2})\.?(\s|$)/.exec(left[0].str.trim()), lab = !!lm;
          if (!cur || lab || (prevY != null && l.yc - prevY > 2.2 * lh)) { cur = { label: lab ? lm[1] : '', lines: [] }; rows.push(cur); }
          prevY = l.yc;
        }
        if (cur) cur.lines.push(l);
      });
      rows.forEach(function (r, idx) {
        var words = [], nameW = [], restW = [];
        r.lines.forEach(function (l) { l.words.forEach(function (w) { words.push(w); (w.x0 < nameR ? nameW : restW).push(w); }); });
        var name = nameW.map(function (w) { return w.str; }).join(' ').replace(/^\s*\d{1,2}\.\d{1,2}\.?\s*/, '').trim();
        if (!name || /^X{3}/.test(norm(name)) || !/[A-Za-zÀ-ú]{4}/.test(name) || (name.match(/[A-Za-zÀ-ú]/g) || []).length < 10) return;
        var restLines = r.lines.map(function (l) { return l.words.filter(function (w) { return w.x0 >= nameR; }).map(function (w) { return w.str; }).join(' '); });
        var restText = colText(r.lines, nameR), rot = /(\d{4})\s*\/\s*(\d{2,5})/.exec(digitize(name.replace(/\s/g, ' ')));
        var row = { page: pg.n, label: r.label || ('linha ' + (idx + 1)), name: name, rotulo: rot ? rot[1] + '/' + rot[2] : '', lots: extractLots(restW), dates: (function () { var a = parseDates(restText), b = parseDates(restLines.join(' ')); a.ranges = a.ranges.concat(b.ranges); return a; })(), restText: restText, vol: null, peso: null, sifs: [] };
        var toks = restW.map(function (w) { return digitize(w.str.trim()).replace(/^[^\dA-Za-z]+|[^\dA-Za-z]+$/g, ''); });
        for (var t = toks.length - 1; t >= 0; t--) { if (/^\d{1,3}(\.\d{3})*,\d{2,3}$/.test(toks[t])) { row.peso = parseNum(toks[t], true); if (t > 0 && /^\d+(\.\d{3})*$/.test(toks[t - 1])) row.vol = parseNum(toks[t - 1], true); break; } }
        toks.forEach(function (x) { if (/^\d{2,5}$/.test(x)) row.sifs.push(x); });
        if (/^\d\.\d/.test(row.label) && D.habilItens[row.label]) row.habil = D.habilItens[row.label];
        else if (Object.keys(D.habilItens).length) row.habilFalta = Object.keys(D.habilItens).sort().join(', ');
        D.rows.push(row);
      });
    });
    // itens sem número (ex.: CSI): numera por página
    var perPage = {}; D.rows.forEach(function (r) { if (!/^\d\.\d/.test(r.label)) { perPage[r.page] = (perPage[r.page] || 0) + 1; r.label = 'item ' + perPage[r.page] + (pages.length > 1 ? ' (pág. ' + r.page + ')' : ''); } });
    D.rows.forEach(function (r) { r.lots.forEach(function (l) { D.allLots.add(l); }); });
    pages.forEach(function (pg) { D.allLots = new Set(Array.from(D.allLots).concat(Array.from(extractLots(pg.lines.reduce(function (a, l) { return a.concat(l.words); }, []))))); });
    if (!pg0Words(pages)) { var s2 = new Set(); lotsFrom(digitize(text), s2); s2.forEach(function (l) { D.allLots.add(l); }); }
    return D;
  }
  function colText(lines, nameR) {
    var segs = [];
    lines.forEach(function (l) { var cur = null; l.words.forEach(function (w) { if (w.x0 < nameR) return; var gap = cur ? w.x0 - cur.x1 : 99, ch = Math.max(3, (w.y1 - w.y0) * 0.9);
      if (cur && gap < ch) { cur.s += ' ' + w.str; cur.x1 = w.x1; } else { cur = { s: w.str, x0: w.x0, x1: w.x1, y: l.yc }; segs.push(cur); } }); });
    var cols = []; segs.forEach(function (g) { var c = cols.find(function (c) { return Math.abs(c.x - g.x0) < 7; }); if (c) c.g.push(g); else cols.push({ x: g.x0, g: [g] }); });
    cols.sort(function (a, b) { return a.x - b.x; });
    return cols.map(function (c) { return c.g.sort(function (a, b) { return a.y - b.y; }).map(function (g) { return g.s; }).join(' '); }).join(' | ');
  }
  function pg0Words(pages) { return pages.some(function (p) { return p.words && p.words.length; }); }
  function habilOf(doc, row) {
    if (row && row.habil && row.habil.length) return { list: row.habil, src: 'Observações, ' + row.label };
    if (doc.parsed.habilObs) return { list: doc.parsed.habilObs, src: 'Observações' };
    if (doc.type === 'csi' && doc.parsed.destField) return { list: countries(doc.parsed.destField), src: 'país de destino do CSI' };
    if (doc.parsed.habilDoc.length) return { list: doc.parsed.habilDoc, src: 'países do cabeçalho' };
    if (doc.parsed.destField) return { list: countries(doc.parsed.destField), src: 'país de destino' };
    return { list: [], src: '' };
  }

  /* ---------- regras de habilitação do Manual CCS ---------- */
  var HB = null; try { HB = JSON.parse($('habil').textContent); } catch (e) {}
  var CL = null; try { CL = JSON.parse($('classif').textContent); } catch (e) {}
  var CLN = { 1: 'Classificação 01 (BR padrão: DCPOA com BRASIL)', 2: 'Classificação 02 (modelo específico: DCPOA com o nome do país)', 3: 'Classificação 03 (habilitação específica: CSN com o nome do país)' };
  var UE27 = ['ALEMANHA', 'AUSTRIA', 'BELGICA', 'BULGARIA', 'CHIPRE', 'CROACIA', 'DINAMARCA', 'ESLOVAQUIA', 'ESLOVENIA', 'ESPANHA', 'ESTONIA', 'FINLANDIA', 'FRANCA', 'GRECIA', 'HOLANDA', 'PAISES BAIXOS', 'HUNGRIA', 'IRLANDA', 'ITALIA', 'LETONIA', 'LITUANIA', 'LUXEMBURGO', 'MALTA', 'POLONIA', 'PORTUGAL', 'REPUBLICA TCHECA', 'TCHEQUIA', 'ROMENIA', 'SUECIA'];
  var UEE5 = ['RUSSIA', 'FEDERACAO RUSSA', 'BIELORRUSSIA', 'BELARUS', 'CAZAQUISTAO', 'ARMENIA', 'QUIRGUISTAO', 'QUIRGUIZISTAO'];
  var ALIAS = { 'EMIRADOS ARABES UNIDOS': 'Emirados Árabes', 'ESTADOS UNIDOS DA AMERICA': 'Estados Unidos', 'EUA': 'Estados Unidos', 'CINGAPURA': 'Singapura', 'KUWAIT': 'Coveite (ou Kuweit)', 'COVEITE': 'Coveite (ou Kuweit)', 'REPUBLICA DA COREIA': 'Coreia do Sul', 'UE': 'União Europeia', 'MACEDONIA DO NORTE': 'Macedônia' };
  function paisKey(nome, dict) {
    var n = norm(nome).replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim(); if (!n || !dict) return null;
    if (ALIAS[n] && dict[ALIAS[n]]) return ALIAS[n];
    var ks = Object.keys(dict), k = ks.find(function (x) { return norm(x) === n; }) || ks.find(function (x) { var y = norm(x); return y.length > 3 && n.length > 3 && (y.indexOf(n) === 0 || n.indexOf(y) === 0); });
    if (k) return k;
    if ((UE27.indexOf(n) >= 0 || (CL && CL.ue.indexOf(n) >= 0)) && dict['União Europeia']) return 'União Europeia';
    if ((UEE5.indexOf(n) >= 0 || (CL && CL.uee.indexOf(n) >= 0)) && dict['União Econômica Eurasiática']) return 'União Econômica Eurasiática';
    return null;
  }
  var SPC = [['AVES', /\bAVES?\b|FRANGO|GALINHA|\bPERU\b|GALLUS|CHESTER/], ['BOVIN', /BOVIN|\bBOI\b|VACA/], ['SUIN', /SUIN|PORCO|PERNIL/], ['PESCADO', /PESCADO|PEIXE|TILAPIA|CAMARAO/], ['OVO', /\bOVO/], ['LACTEO', /LEITE|LACTEO|QUEIJO/], ['MEL', /\bMEL\b/]];
  var ESPEC = /GELATINA|COLAGENO|OLEO|FARINHA|PELE|COURO|PROTEINA|SANGUE|TRIPA|ENVOLTORIO|SEBO|ALIMENTA|PETFOOD|SUBPRODUTO|CONSERVA|NAO COMESTIVEL|CHIFRE|\bOSSO|GORDURA|BANHA|HEMODERIVADO|CALCULO|\bVIVA|EXTRATO|MORDEDOR|TERMO|PROCESSAD|COZID|EMBUTIDO|ESTERILIZ|PREPARADO|A BASE DE|COMPOSTO|SALGAD|HIDROLISAD|PETISCO|SORO/g;
  var ORD = { sem: 5, esp: 4, ue: 3, br: 2, out: 1 };
  var CATN = { br: 'lista Brasil', ue: 'segue UE / EUA', esp: 'habilitação específica', sem: 'sem CSI acordado', out: 'forma não classificada' };
  var TMN = { br: 'modelo BR', brp: 'modelo específico do país', esp: 'modelo específico', epoa: 'modelo _EPOA_BR (armazém pode ser lista Brasil)', ue: 'modelo UE' };
  function regra(destino, desc) {
    var R = { destino: destino, pais: null, cat: null, rows: [], epoa: null, epoaTxt: '' };
    if (!HB || !destino) return R;
    var k = paisKey(destino, HB.pais); R.pais = k;
    var U = norm(desc), sp = SPC.filter(function (x) { return x[1].test(U); }).map(function (x) { return x[0]; }); R.sp = sp;
    // país fora da tabela da DHC: sem exigência específica, vale o CSI_BR (lista Brasil)
    R.pl = planilha(destino, sp, U);
    if (!k) { if (R.pl) { R.cat = R.pl.c === 3 ? 'esp' : 'br'; R.modeloPais = R.pl.c === 2; R.fonte = 'planilha'; } else { R.cat = 'br'; R.semTabela = true; } }
    var cms = /MECANICAMENTE SEPARADA|\bCMS\b/.test(U), pw = (U.match(ESPEC) || []);
    if (k) {
      var rows = HB.pais[k].filter(function (r) { var e = norm(r.e); return !/ESTOCAGEM/.test(e) && (!sp.length || sp.some(function (x) { return e.indexOf(x) >= 0; }) || /TODOS/.test(norm(r.p))); });
      var cmsRows = cms ? rows.filter(function (r) { var p = norm(r.p); return /MECANICAMENTE|\bCMS\b/.test(p) && !/FARINHA|ALIMENTA|PETFOOD/.test(p); }) : [];
      var fit = cmsRows.length ? cmsRows : rows.filter(function (r) { var w = norm(r.p).match(ESPEC) || []; return !w.length || w.some(function (x) { return pw.indexOf(x) >= 0; }); });
      if (!fit.length) fit = rows.filter(function (r) { return !(norm(r.p).match(ESPEC) || []).length; });
      R.rows = fit;
      if (fit.length) { R.cat = fit.map(function (r) { return r.cat; }).sort(function (a, b) { return ORD[b] - ORD[a]; })[0];
        // lista Brasil com modelo do país (ex.: _BR_Jordania): o nome do país precisa estar na habilitação
        R.modeloPais = R.cat === 'br' && fit.some(function (r) { return r.cat === 'br' && r.tm && r.tm !== 'br'; }); R.fonte = 'manual';
        if (R.pl) { var pc = R.pl.c, esp = R.cat === 'esp' || R.cat === 'ue';
          if ((pc === 3 && !esp) || (pc < 3 && esp) || (pc === 2 && R.cat === 'br' && !R.modeloPais)) R.conflito = 'a planilha Documento Sanitário x Habilitação coloca ' + R.pl.nome + ' na ' + CLN[pc] + ', e o Manual (DHC ' + HB.dt + ') diz ' + CATN[R.cat] + (R.modeloPais ? ' com modelo do país' : '') + '. Foi usado o Manual.'; } }
    }
    if (k && !R.cat && R.pl) { R.cat = R.pl.c === 3 ? 'esp' : 'br'; R.modeloPais = R.pl.c === 2; R.fonte = 'planilha'; }
    else if (k && R.cat === 'sem' && R.pl) R.conflito = 'o Manual (DHC ' + HB.dt + ') não mostra CSI acordado para o produto, e a planilha Documento Sanitário x Habilitação coloca ' + R.pl.nome + ' na ' + CLN[R.pl.c] + '.';
    var ke = paisKey(destino, HB.epoa);
    if (ke) {
      var EP = HB.epoa[ke], er = EP.r.find(function (r) { var p = norm(r.p); return sp.some(function (x) { return p.indexOf(x) >= 0; }); }) || EP.r.find(function (r) { return /TODOS/.test(norm(r.p)); }) || (EP.r.length === 1 ? EP.r[0] : null);
      R.epoa = er ? er.c : EP.c; R.epoaTxt = er ? (er.f + (er.i ? ' · ' + er.i : '')) : '';
    }
    return R;
  }
  function planilha(destino, sp, U) {
    if (!CL) return null;
    var n = norm(destino).replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim(), ks = Object.keys(CL.cls);
    var k = ks.find(function (x) { return x === n; }) || ks.find(function (x) { return x.length > 3 && n.length > 3 && (x.indexOf(n) === 0 || n.indexOf(x) === 0); });
    if (!k) { var pk = paisKey(destino, HB && HB.pais); if (pk) k = ks.find(function (x) { return x === norm(pk); }); }
    if (!k) return null;
    var L = CL.cls[k].filter(function (x) { if (!x.q) return true; var q = x.q;
      if (/AVE/.test(q)) return sp.indexOf('AVES') >= 0; if (/SUIN/.test(q)) return sp.indexOf('SUIN') >= 0; if (/BOVIN/.test(q)) return sp.indexOf('BOVIN') >= 0;
      if (/TERMO/.test(q)) return /TERMO|COZID|PROCESSAD/.test(U); if (/NATURA/.test(q)) return !/TERMO|COZID|PROCESSAD/.test(U); return true; });
    if (!L.length) return null;
    return { c: Math.max.apply(null, L.map(function (x) { return x.c; })), nome: L.map(function (x) { return x.n; }).join(' / ') };
  }
  // ficha do estabelecimento (Produtos Habilitados para Exportação): países da estocagem
  var FICHA_PADRAO = { '3403': { sif: '3403', fonte: 'ficha do SIF 3403 (18/11/2026)', est: 'ÁFRICA DO SUL, ARGENTINA, BRASIL, CANADÁ, CHINA, REPUBLICA POPULAR, CORÉIA (DO SUL), REPÚBLICA DA, EGITO, HONG KONG, ILHAS SALOMÃO, JAPÃO, MÉXICO, PARAGUAI, REINO UNIDO, URUGUAI, UNIÃO ECONÔMICA EURASIÁTICA (UEE), UNIÃO EUROPEIA (UE)' } };
  function parseFicha(pages) {
    var F = { sif: '', est: '', fonte: '' }, px = null, on = false, lt = '';
    pages.forEach(function (pg) { pg.lines.forEach(function (L) {
      var U = norm(L.text), m;
      if (!F.sif && (m = /SIF\s*:\s*(\d+)/.exec(U))) F.sif = m[1];
      if (px == null) { var w = L.words.find(function (x) { return /^PAIS$/.test(norm(x.str).trim()); }); if (w && /PRODUTO/.test(U)) px = w.x0; return; }
      var left = L.words.filter(function (x) { return x.x0 < px - 8; }).map(function (x) { return x.str; }).join(' ').trim();
      var right = L.words.filter(function (x) { return x.x0 >= px - 8 && x.x0 < px + 160; }).map(function (x) { return x.str; }).join(' ').trim();
      if (/ESTOCAGEM/.test(norm(left))) { on = true; lt = left; F.est += ' ' + right; return; }
      if (on) { if (left && /\(DHC\)|\)\s*$/.test(norm(lt))) on = false; else { lt += ' ' + left; F.est += ' ' + right; } }
    }); });
    F.fonte = 'ficha do SIF ' + F.sif + ' carregada'; return F;
  }
  function regraTxt(R) {
    if (R.semTabela) return 'lista Brasil, sem CSI acordado (basta BRASIL ou habilitação maior)';
    if (!R.cat) return 'produto não encontrado na tabela do país';
    if (R.cat === 'br') return R.modeloPais ? 'lista Brasil com modelo do país (o nome do país precisa estar na habilitação)' : 'lista Brasil (basta BRASIL ou habilitação maior)';
    if (R.cat === 'esp' || R.cat === 'ue') return (R.cat === 'ue' ? 'segue UE' : 'habilitação específica') + ' (nome do país na habilitação; respaldo por CSN)';
    return CATN[R.cat];
  }
  var NOMES = null;
  function cl(x) { return norm(x).replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function nomesPaises() {
    if (NOMES) return NOMES;
    var st = new Set(['BRASIL', 'UNIAO EUROPEIA', 'UNIAO ECONOMICA EURASIATICA', 'ESTADOS UNIDOS', 'REINO UNIDO', 'HONG KONG', 'COREIA DO SUL']);
    (HB ? Object.keys(HB.pais).concat(Object.keys(HB.epoa)) : []).forEach(function (k) { st.add(cl(k)); });
    if (CL) { Object.keys(CL.cls).forEach(function (k) { st.add(cl(k)); }); CL.ue.concat(CL.uee).forEach(function (k) { st.add(cl(k)); }); }
    Object.keys(ALIAS).forEach(function (a) { st.add(a); });
    NOMES = Array.from(st).filter(function (x) { return x.length > 2; }); return NOMES;
  }
  function lev(a, b) { var m = a.length, n = b.length, d = [], i, j; for (i = 0; i <= m; i++) d[i] = [i]; for (j = 0; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) { d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); } return d[m][n]; }
  var NAOPAIS = ['ITEM', 'ITENS', 'HABILITACAO', 'HABILITADO', 'HABILITADOS', 'HABILITACOES', 'PARA', 'REPUBLICA', 'POPULAR', 'PRODUTO', 'PRODUTOS', 'OBSERVACOES', 'CONFORME', 'PAISES'];
  function achaPaises(list) {
    var words = norm((list || []).join(' , ')).replace(/[^A-Z]+/g, ' ').trim().split(' ').filter(Boolean);
    var known = new Set(NAOPAIS); nomesPaises().forEach(function (n) { n.split(' ').forEach(function (w) { known.add(w); }); });
    var kw = Array.from(known).filter(function (w) { return w.length >= 4; }), fixes = [];
    var corr = words.map(function (w) {
      if (known.has(w) || w.length < 5) return w;
      var best = null, bd = 9; kw.forEach(function (k) { if (Math.abs(k.length - w.length) > 2) return; var dd = lev(w, k); if (dd < bd) { bd = dd; best = k; } });
      if (best && bd <= (w.length >= 8 ? 2 : 1)) { fixes.push(w + ' (' + best + ')'); return best; }
      return w;
    });
    var T = ' ' + corr.join(' ') + ' ';
    return { tem: function (nome) { nome = cl(nome); return nome.length > 1 && T.indexOf(' ' + nome + ' ') >= 0; }, fixes: fixes };
  }
  // confere uma lista de habilitação contra a regra do país
  function checaHab(R, list, docType, doc) {
    var out = { probs: [], warns: [] }, d = norm(R.destino).replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim(), L = list || [];
    // procura os nomes dos países dentro do texto (a habilitação pode vir sem vírgulas)
    var AP = achaPaises(L), tem = AP.tem;
    if (AP.fixes.length) out.warns.push('nome de país escrito errado na habilitação: ' + AP.fixes.join(', '));
    var hasUE = tem('UNIAO EUROPEIA') || tem('COMUNIDADE EUROPEIA') || tem('UE'), hasBR = tem('BRASIL');
    var nomesDest = [d]; if (R.pais) nomesDest.push(R.pais); Object.keys(ALIAS).forEach(function (a) { if (ALIAS[a] === R.pais) nomesDest.push(a); });
    var hasDest = (R.pais === 'União Europeia' && hasUE) || nomesDest.some(tem);
    if (!L.length) { if (docType === 'dcpoa') out.probs.push('a DCPOA não mostra a habilitação'); else out.warns.push('habilitação não encontrada no documento'); return out; }
    var cat = R.cat;
    if (cat === 'br' && R.modeloPais) { if (!hasDest) out.probs.push('modelo específico de ' + R.destino + ': o nome do país precisa estar na habilitação (' + L.join(', ') + ')'); }
    else if (cat === 'br') {
      // habilitação maior: algum país da lista que exige habilitação específica (ou UE) para a mesma espécie
      var maior = (HB ? Object.keys(HB.pais) : []).filter(tem).filter(function (k2) { return HB.pais[k2].some(function (r) { var e = norm(r.e); return (r.cat === 'esp' || r.cat === 'ue') && !/ESTOCAGEM/.test(e) && (!R.sp || !R.sp.length || R.sp.some(function (x) { return e.indexOf(x) >= 0; })); }); });
      if (CL) Object.keys(CL.cls).forEach(function (k3) { if (CL.cls[k3].some(function (x) { return x.c === 3; }) && tem(k3)) maior.push(k3); });
      if (!(hasBR || hasDest || hasUE || maior.length)) out.warns.push('lista Brasil: a habilitação não traz BRASIL nem uma habilitação maior (' + L.join(', ') + '): confirmar');
    }
    else if (cat === 'ue') { if (!(hasUE || hasDest)) out.probs.push('segue UE, mas falta a habilitação União Europeia (' + L.join(', ') + ')'); }
    else if (cat === 'sem') out.warns.push('o Manual não mostra CSI acordado para este produto: confirmar');
    else if (!hasDest) out.probs.push('não habilitado para ' + (R.pais === 'União Europeia' ? 'UNIÃO EUROPEIA' : R.destino) + ' (' + L.join(', ') + ')' + (cat === 'esp' ? ', que exige habilitação específica' : ''));
    if ((cat === 'esp' || cat === 'ue') && docType) {
      if (docType === 'dcpoa') out.probs.push('país que exige habilitação: não pode ser DCPOA de trânsito, o respaldo precisa ser CSN (salvo liberação do MAPA)');
      else if (docType === 'sigsif') out.warns.push('habilitação específica: confirmar se o respaldo SIGSIF é aceito (o padrão é CSN)');
      else if (docType === 'csi' && doc && doc.parsed.destField && paisKey(doc.parsed.destField, HB.pais) !== R.pais) out.warns.push('habilitação específica com respaldo CSI de outro destino: confirmar');
    }
    return out;
  }

  /* ---------- estado e lista ---------- */
  var files = [], seq = 0;
  function render() {
    var ul = $('flist'); ul.innerHTML = '';
    files.forEach(function (f) {
      var li = document.createElement('li'); li.setAttribute('data-k', f.ext === 'xlsx' ? 'XLSX' : 'PDF'); if (f.ext === 'xlsx') li.className = 'xls';
      var st = f.status === 'lendo' ? '<span class="tag eq">' + esc(f.msg || 'Lendo…') + '</span>' : f.status === 'erro' ? '<span class="tag err">' + esc(f.msg) + '</span>' : '<span class="tag ok">Lido</span>';
      var ocr = f.pages && f.pages.some(function (p) { return p.ocr; }) ? ' <span class="tag warn">OCR</span>' : '';
      var sel = '<select data-id="' + f.id + '" class="ty">' + Object.keys(TYPES).map(function (k) { return '<option value="' + k + '"' + (f.type === k ? ' selected' : '') + '>' + TYPES[k] + '</option>'; }).join('') + '</select>';
      var num = isResp(f.type) ? ' Nº <input data-id="' + f.id + '" class="nu" value="' + esc(f.numero || '') + '" placeholder="não lido">' : '';
      li.innerHTML = '<div class="name">' + esc(f.name) + '</div><button class="xrm" title="Remover" data-id="' + f.id + '">×</button>' +
        '<div class="meta">' + st + ocr + (f.status === 'ok' ? sel + num + (f.pages ? '<span>' + f.pages.length + ' pág.</span>' : '') : '') + '</div>' +
        (f.status === 'lendo' ? '<div class="bar"><i style="width:' + Math.round((f.prog || 0) * 100) + '%"></i></div>' : '');
      ul.appendChild(li);
    });
    $('run').disabled = !files.length || files.some(function (f) { return f.status === 'lendo'; });
  }
  $('flist').addEventListener('click', function (e) { var id = e.target.getAttribute('data-id'); if (e.target.classList.contains('xrm')) { files = files.filter(function (f) { return String(f.id) !== id; }); render(); } });
  $('flist').addEventListener('change', function (e) {
    var id = e.target.getAttribute('data-id'), f = files.find(function (x) { return String(x.id) === id; }); if (!f) return;
    if (e.target.classList.contains('ty')) { f.type = e.target.value; prepare(f); render(); }
    if (e.target.classList.contains('nu')) { f.numero = e.target.value.trim(); f.key = certKey(f.numero); f.manualNum = true; }
  });
  function prepare(f) {
    if (isResp(f.type)) { f.parsed = parseRespaldo(f.pages, f.type); if (!f.manualNum) { f.numero = f.parsed.numero; f.key = f.parsed.key; } }
  }
  var queue = Promise.resolve();
  function addFiles(list) {
    Array.prototype.forEach.call(list, function (file) {
      var ext = /\.xls[xm]$/i.test(file.name) ? 'xlsx' : /\.pdf$/i.test(file.name) ? 'pdf' : '';
      if (!ext) return;
      var f = { id: ++seq, file: file, name: file.name, ext: ext, status: 'lendo', prog: 0, msg: 'Na fila' };
      files.push(f);
      queue = queue.then(async function () {
        try {
          f.msg = 'Lendo…'; render();
          f.pages = ext === 'xlsx' ? await readXlsx(f) : await readPdf(f, function (p, m) { f.prog = p; f.msg = m; render(); }, $('forceocr').checked);
          var txt = f.pages.map(function (p) { return p.lines.map(function (l) { return l.text; }).join('\n'); }).join('\n');
          f.type = classify(txt); f.status = 'ok'; prepare(f);
        } catch (e) { f.status = 'erro'; f.msg = 'Não consegui ler: ' + (e && e.message || e); }
        render();
      });
    });
    render();
  }
  var drop = $('drop');
  drop.onclick = function () { $('file').click(); };
  drop.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); } };
  $('file').onchange = function () { addFiles(this.files); this.value = ''; };
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });
  $('clear').onclick = function () { files = []; render(); $('out').classList.add('hide'); $('out').innerHTML = ''; };
  $('run').onclick = function () { try { analyse(); } catch (e) { $('out').classList.remove('hide'); $('out').innerHTML = '<div class="panel"><ul class="issues"><li class="err"><span class="w">Erro</span>' + esc(e.message) + '</li></ul></div>'; console.error(e); } };

  /* ---------- conferência ---------- */
  function analyse() {
    var issues = [], seen = {}, add = function (k, t, d) { if (seen[k + t]) return; seen[k + t] = 1; issues.push({ k: k, t: t, d: d }); }, E = function (t, d) { add('err', t, d); }, W = function (t, d) { add('warn', t, d); };
    var pscfF = files.find(function (f) { return f.type === 'pscf' && f.status === 'ok'; }), anxF = files.find(function (f) { return f.type === 'anexo4' && f.status === 'ok'; });
    var resp = files.filter(function (f) { return isResp(f.type) && f.status === 'ok'; });
    var out = $('out'); out.classList.remove('hide');
    if (!pscfF) { out.innerHTML = '<div class="panel"><ul class="issues"><li class="err"><span class="w">Falta o relatório PSCF 7446.</span> Ele é a base da conferência (Excel ou PDF).</li></ul></div>'; return; }
    var P = parsePSCF(pscfF.pages, pscfF.ext === 'pdf'), A = anxF ? parseAnexo(anxF.pages) : null;
    if (!P.lines.length) E('Não consegui ler os lotes do relatório PSCF.', 'Confira se é o relatório 7446, modelo 4 (agrupado por data de produção).');
    var destino = norm(P.destino || (A && A.destino) || '').trim();
    var lotRows = [], RG = {}, rgOf = function (l) { var d = l.prod ? l.prod.desc : ''; return RG[d] || (RG[d] = regra(P.destino || (A && A.destino) || '', d)); };

    // cabeçalho
    if (!A) W('Anexo IV não carregado.', 'Sem ele não dá para cruzar lotes, volumes e certificados declarados.');
    else {
      if (A.destino && P.destino && norm(A.destino) !== norm(P.destino)) E('País de destino diferente.', 'PSCF: ' + P.destino + ' · Anexo IV: ' + A.destino);
      if (A.embarque && P.ref && P.ref.replace(/\D/g, '').indexOf(A.embarque) < 0) E('Nº do relatório de embarque diferente.', 'Anexo IV: ' + A.embarque + ' · PSCF (referência): ' + P.ref);
    }

    // por certificado
    var byCert = {}; P.lines.forEach(function (l) { var k = l.key || ('sem-' + l.sif); (byCert[k] = byCert[k] || []).push(l); });
    var usedDocs = new Set();
    Object.keys(byCert).forEach(function (k) {
      var ls = byCert[k], cert = ls[0].cert, hab = P.habil[k];
      if (!cert) { ls.forEach(function (l) { lotRows.push({ l: l, st: 'warn', msg: 'Sem certificado no PSCF' }); }); W('Lotes sem certificado no PSCF (SIF ' + ls[0].sif + ').', ls.map(function (l) { return l.lote; }).join(', ')); return; }
      var tipoPscf = tipoNum(cert), dg = String(cert).replace(/\D/g, '');
      if (!numPadrao(cert)) E(TYPES[tipoPscf] + ' com número fora do padrão no PSCF: ' + cert + '.', tipoPscf === 'dcpoa' ? 'Padrão: 000000/SIF/26.' : 'Padrão: ' + cert.slice(0, 2) + '-00000000/SIF/26 (ano com 2 dígitos).');
      dg = certKey(cert) || dg;
      var km = function (f) { return f.key && (f.key === k || (k.length > 4 && f.key.indexOf(k) >= 0)); };
      var doc = resp.find(function (f) { return km(f) && f.type === tipoPscf; }) || resp.find(km) ||
        (dg.length >= 6 ? resp.find(function (f) { return f.parsed && f.parsed.text.split(/\s+/).some(function (t) { var x = t.replace(/\D/g, ''); return x.length >= 6 && (x === dg || x.indexOf(dg) >= 0); }); }) : null);
      if (!doc) {
        if (hab && destino && hab.list.length) { var ch0 = checaHab(rgOf(ls[0]), hab.list, null, null); if (ch0.probs.length) E(cert + ' (habilitação no PSCF): ' + ch0.probs.join('; ') + '.', ''); }
        E(TYPES[tipoPscf] + ' ' + cert + ' não foi carregado.', 'SIF ' + ls[0].sif + ' · NF ' + ls[0].nf + ' · lotes ' + ls.map(function (l) { return l.lote; }).join(', '));
        ls.forEach(function (l) { lotRows.push({ l: l, st: 'err', msg: 'Documento não carregado' }); });
        return;
      }
      usedDocs.add(doc.id);
      if (doc.type !== tipoPscf && isResp(doc.type)) W(cert + ': pelo número é ' + TYPES[tipoPscf] + ', mas o arquivo foi lido como ' + TYPES[doc.type] + '.', 'Confira o tipo na lista de arquivos.');
      var G = {}, addG = function (kind, msg, lote) { var kk = kind + '|' + msg; (G[kk] = G[kk] || { kind: kind, msg: msg, lots: [] }); if (G[kk].lots.indexOf(lote) < 0) G[kk].lots.push(lote); };
      var D = doc.parsed, tipo = TYPES[doc.type], perRow = {}, viaOcr = doc.pages.some(function (p) { return p.ocr; }), Q = viaOcr ? W : E, qn = viaOcr ? ' (número lido por OCR: confira no documento)' : '';
      if (doc.type === 'csn' && D.destSif && A && A.sif && D.destSif !== A.sif) E(cert + ': destinatário é o SIF ' + D.destSif + ', mas a carga sai do SIF ' + A.sif + '.', 'Confira se o ' + tipo + ' é mesmo o respaldo deste armazenador.');
      if (doc.type === 'csi' && D.destField && destino && countries(D.destField).indexOf(destino) < 0) E(cert + ': CSI emitido para ' + D.destField + ', mas a carga vai para ' + destino + '.', '');
      var noRot = false;
      ls.forEach(function (l) {
        var rows = D.rows.filter(function (r) { return r.lots.has(l.lote); }), row = null, probs = [], warns = [];
        if (rows.length) {
          rows.forEach(function (r) { r._s = nameScore(l.prod ? l.prod.desc : '', r.name) + (r.rotulo && r.rotulo === l.rotulo ? 1 : 0); });
          row = rows.sort(function (a, b) { return b._s - a._s; })[0];
        } else if (D.allLots.has(l.lote)) warns.push('lote aparece no documento, mas fora da tabela de produtos');
        else probs.push('lote não consta no ' + tipo);
        if (!rows.length && l.rotulo) { var rots = Array.from(new Set(D.rows.map(function (r) { return r.rotulo; }).filter(Boolean)));
          if (rots.length && rots.indexOf(l.rotulo) < 0) probs.push('rótulo ' + l.rotulo + ' não consta no ' + tipo + ' (rótulos do documento: ' + rots.join(', ') + ')'); }
        var h = habilOf(doc, row);
        if (row) {
          if (row.rotulo) { if (row.rotulo !== l.rotulo) probs.push('rótulo ' + l.rotulo + ' no PSCF × ' + row.rotulo + ' no ' + tipo); }
          else if (doc.type === 'csn') warns.push('rótulo não lido no ' + tipo); else noRot = true;
          if (l.prod && nameScore(l.prod.desc, row.name) < 0.75) warns.push('nome do produto diferente: "' + row.name + '"');
          var okDate = inDates(l.dtProd, row.dates); if (okDate === false) probs.push('data de produção ' + showD(l.dtProd) + ' fora das datas do item');
          if (l.dtVal && row.dates.months.size) { var mv = l.dtVal.slice(0, 7); if (!row.dates.months.has(mv)) warns.push('validade ' + showD(l.dtVal) + ' não bate com ' + Array.from(row.dates.months).map(function (x) { return x.slice(5) + '/' + x.slice(0, 4); }).join(', ')); }
          if (l.sif && row.sifs.indexOf(l.sif) < 0 && norm(D.text).indexOf('SIF ' + l.sif) < 0 && norm(D.text).indexOf('SIF' + l.sif) < 0) warns.push('SIF ' + l.sif + ' não encontrado no item');
          var pk = row.label; perRow[pk] = perRow[pk] || { row: row, vol: 0, pl: 0 }; perRow[pk].vol += l.vol || 0; perRow[pk].pl += l.pl || 0;
        }
        if (row && row.habilFalta) probs.push('o item ' + row.label + ' não aparece na habilitação das Observações (itens citados: ' + row.habilFalta + ')');
        else if (destino) { var ch = checaHab(rgOf(l), h.list, doc.type, doc); ch.probs.forEach(function (x) { probs.push(x); }); ch.warns.forEach(function (x) { if (warns.indexOf(x) < 0) warns.push(x); }); }
        if (l.marca && norm(D.text).indexOf(norm(l.marca)) < 0 && doc.type === 'csn') probs.push('marca ' + l.marca + ' não aparece no ' + tipo);
        probs.forEach(function (x) { addG('err', x, l.lote); }); warns.forEach(function (x) { addG('warn', x, l.lote); });
        lotRows.push({ l: l, row: row, hab: h, doc: doc, st: probs.length ? 'err' : warns.length ? 'warn' : 'ok', msg: probs.concat(warns).join('; ') });
      });
      Object.keys(G).forEach(function (kk) { var g = G[kk], txt = TYPES[doc.type] + ' ' + cert + ': ' + g.msg + '.', det = (g.lots.length === ls.length && ls.length > 1 ? 'Todos os lotes deste documento' : (g.lots.length > 1 ? 'Lotes ' : 'Lote ') + g.lots.join(', '));
        (g.kind === 'err' ? E : W)(txt, det); });
      if (noRot) W(cert + ': o ' + tipo + ' não traz rótulo.', 'Rótulo no PSCF: ' + Array.from(new Set(ls.map(function (l) { return l.rotulo; }))).join(', ') + '. Conferir por outra fonte se o destino exigir.');
      Object.keys(perRow).forEach(function (pk) {
        var x = perRow[pk], r = x.row;
        if (r.vol != null && x.vol > r.vol) Q(cert + ' · ' + r.label + ': o PSCF usa ' + fmtN(x.vol) + ' volumes, mais que os ' + fmtN(r.vol) + ' do documento.', qn);
        if (r.peso != null && x.pl > r.peso + 0.01) Q(cert + ' · ' + r.label + ': o PSCF usa ' + fmtN(x.pl, 2) + ' kg, mais que os ' + fmtN(r.peso, 2) + ' kg do documento.', qn);
      });
      if (false && hab && h0(doc).length) { var dl = h0(doc), pl = hab.list; var diff = pl.filter(function (c) { return dl.indexOf(c) < 0; }); if (diff.length) W(cert + ': habilitação do PSCF tem país que o documento não mostra.', 'PSCF: ' + pl.join(', ') + ' · documento: ' + dl.join(', ')); }
    });
    function h0(doc) { var s = new Set(); doc.parsed.rows.forEach(function (r) { (habilOf(doc, r).list || []).forEach(function (c) { s.add(c); }); }); if (!doc.parsed.rows.length) habilOf(doc, null).list.forEach(function (c) { s.add(c); }); return Array.from(s); }
    resp.forEach(function (f) { if (!usedDocs.has(f.id)) W('Documento carregado que o PSCF não usa: ' + f.name, 'Nº lido: ' + (f.numero || 'não lido') + '. Se o número estiver errado, corrija no campo da lista.'); });

    // regra do entreposto (armazém de onde a carga sai)
    var fichas = {}; Object.keys(FICHA_PADRAO).forEach(function (x) { fichas[x] = FICHA_PADRAO[x]; });
    files.forEach(function (f) { if (f.type === 'ficha' && f.status === 'ok') { var fx = parseFicha(f.pages); if (fx.sif) fichas[fx.sif] = fx; } });
    var fic = A && A.sif ? fichas[A.sif] : null;
    Object.keys(RG).forEach(function (d) { var R = RG[d], sif = A && A.sif ? 'SIF ' + A.sif : 'o armazém';
      if (R.epoa === 'nao') E((R.pais || R.destino) + ' não aceita entreposto (EPOA): a carga não pode sair do ' + sif + '.', '');
      else if (R.epoa === 'hab') {
        if (fic) { var mf = achaPaises([fic.est]); R.epoaOk = [R.destino, R.pais].filter(Boolean).some(mf.tem) || (R.pais === 'União Europeia' && mf.tem('UNIAO EUROPEIA'));
          if (!R.epoaOk) E('O ' + sif + ' não tem habilitação de estocagem para ' + (R.pais || R.destino) + ', que exige entreposto habilitado.', 'Conferido na ' + fic.fonte + '.'); }
        else W('Para ' + (R.pais || R.destino) + ' o entreposto precisa de habilitação. Carregue a ficha do ' + sif + ' para conferir.', '');
      }
      if (R.pais && !R.cat) W('Não achei no Manual a linha de ' + R.pais + ' para o produto "' + d + '".', 'A habilitação foi conferida pelo nome do país.'); });
    // Anexo IV × PSCF
    var axRows = [];
    if (A) {
      var pAgg = {}; P.resumo.forEach(function (r) { var kk = r.sif + '|' + r.lote; pAgg[kk] = pAgg[kk] || { sif: r.sif, lote: r.lote, dtProd: r.dtProd, vol: 0, pl: 0 }; pAgg[kk].vol += r.vol || 0; pAgg[kk].pl += r.pl || 0; });
      var aAgg = {}; A.prods.forEach(function (pr) { pr.lots.forEach(function (l) { var kk = (l.sif || pr.sif) + '|' + l.lote; aAgg[kk] = aAgg[kk] || { sif: l.sif || pr.sif, lote: l.lote, dtProd: l.dtProd, vol: 0, pl: 0, prod: pr }; aAgg[kk].vol += l.vol || 0; aAgg[kk].pl += l.pl || 0; }); });
      Array.from(new Set(Object.keys(pAgg).concat(Object.keys(aAgg)))).sort().forEach(function (kk) {
        var p = pAgg[kk], a = aAgg[kk], st = 'ok', msg = '';
        if (!a) { st = 'err'; msg = 'lote do PSCF não está no Anexo IV'; }
        else if (!p) { st = 'err'; msg = 'lote do Anexo IV não está no PSCF'; }
        else {

        }
        var o = p || a; if (st === 'err') E('Anexo IV: ' + msg + '.', 'SIF ' + o.sif + ' · lote ' + o.lote);
        axRows.push({ sif: o.sif, lote: o.lote, p: p, a: a, st: st, msg: msg });
      });
      // certificados declarados no Anexo IV
      var pcBySif = {}; P.lines.forEach(function (l) { if (l.key) { (pcBySif[l.sif] = pcBySif[l.sif] || {})[l.key] = l.cert; } });
      var acBySif = {}; A.prods.forEach(function (pr) { pr.certs.forEach(function (c) { (acBySif[pr.sif] = acBySif[pr.sif] || {})[c.key] = c; }); if (l0(pr) && P.lines.length) { var pd = P.lines.find(function (l) { return l.sif === pr.sif && l.prod; }); if (pd && nameScore(pd.prod.desc, pr.nome) < 0.75) W('Anexo IV, produto ' + pr.n + ': nome diferente do PSCF.', 'Anexo IV: ' + pr.nome + ' · PSCF: ' + pd.prod.desc); } });
      Object.keys(pcBySif).forEach(function (s) { Object.keys(pcBySif[s]).forEach(function (kk) { if (!(acBySif[s] || {})[kk]) E('Anexo IV não lista o ' + pcBySif[s][kk] + ' (SIF ' + s + ').', 'O PSCF usa esse certificado.'); }); });
      Object.keys(acBySif).forEach(function (s) { Object.keys(acBySif[s]).forEach(function (kk) { if (!(pcBySif[s] || {})[kk]) E('Anexo IV lista o ' + acBySif[s][kk].num + ' (SIF ' + s + '), que o PSCF não usa.', ''); }); });
      Object.keys(acBySif).forEach(function (s) { Object.keys(acBySif[s]).forEach(function (kk) { var c = acBySif[s][kk], d = resp.find(function (f) { return f.key === kk; }); if (d && ((c.col === 'CSN' && d.type !== 'csn') || (c.col === 'CSI' && d.type !== 'csi') || (c.col === 'DCPOA' && d.type !== 'dcpoa'))) W('Anexo IV coloca o ' + c.num + ' na coluna ' + c.col + ', mas o documento é ' + TYPES[d.type] + '.', ''); }); });
    }
    function l0(pr) { return pr.lots.length; }

    paint(P, A, issues, lotRows, axRows, resp, RG);
  }

  function paint(P, A, issues, lotRows, axRows, resp, RG) {
    var nE = issues.filter(function (i) { return i.k === 'err'; }).length, nW = issues.length - nE;
    var nOk = lotRows.filter(function (r) { return r.st === 'ok'; }).length;
    var h = '<div class="sum"><div class="kpi ' + (nE ? 'err' : 'ok') + '"><b>' + nE + '</b><span>divergência' + (nE === 1 ? '' : 's') + '</span></div>' +
      '<div class="kpi warn"><b>' + nW + '</b><span>aviso' + (nW === 1 ? '' : 's') + ' para olhar</span></div>' +
      '<div class="kpi ok"><b>' + nOk + '/' + lotRows.length + '</b><span>lotes do PSCF conferidos sem problema</span></div></div>';
    h += '<div class="panel"><div class="ctx"><span>Destino: <b>' + esc(P.destino || (A && A.destino) || '—') + '</b></span><span>Referência: <b>' + esc(P.ref || '—') + '</b></span><span>O.C.: <b>' + esc(P.oc || '—') + '</b></span>' +
      (A ? '<span>Anexo IV: <b>' + esc(A.numero || '—') + '</b></span><span>Sai do SIF: <b>' + esc(A.sif || '—') + '</b></span>' : '') + '</div>';
    var SPN = { AVES: 'aves', BOVIN: 'bovinos', SUIN: 'suínos', PESCADO: 'pescado', OVO: 'ovos', LACTEO: 'lácteos', MEL: 'mel' }, vistos = {};
    Object.keys(RG || {}).forEach(function (d) { var R = RG[d], sp = (R.sp || []).map(function (x) { return SPN[x]; }).join(', '), t = regraTxt(R), kk = (R.pais || R.destino) + sp + t + R.epoa + R.epoaOk; if (vistos[kk]) return; vistos[kk] = 1;
      var ent = R.epoa === 'hab' ? (R.epoaOk ? ' · entreposto ' + esc(A && A.sif ? 'SIF ' + A.sif : '') + ' habilitado ✓' : ' · entreposto precisa de habilitação') : R.epoa === 'nao' ? ' · não aceita entreposto' : '';
      h += '<div class="rule" title="Manual CCS · tabela DHC de ' + esc(HB ? HB.dt : '') + '. Casos liberados pelo MAPA não estão na tabela."><b>' + esc(R.pais || R.destino) + (sp ? ' · ' + esc(sp) : '') + '</b>: ' + esc(t) + ent + '</div>'; });
    var errs = issues.filter(function (i) { return i.k === 'err'; }), wrs = issues.filter(function (i) { return i.k === 'warn'; });
    if (!issues.length) h += '<div class="allok">Tudo confere entre PSCF, Anexo IV e os documentos de respaldo.</div>';
    if (errs.length) h += '<h2>Divergências</h2><ul class="issues">' + errs.map(li).join('') + '</ul>';
    if (wrs.length) h += '<h2 style="margin-top:16px">Avisos</h2><ul class="issues">' + wrs.map(li).join('') + '</ul>';
    h += '<div class="row" style="margin-top:12px"><span></span><div><button class="btn ghost" id="prt">Imprimir / salvar PDF</button></div></div></div>';
    function li(i) { return '<li class="' + i.k + '"><span class="w">' + (i.k === 'err' ? '✕' : '!') + '</span>' + esc(i.t) + (i.d ? '<small>' + esc(i.d) + '</small>' : '') + '</li>'; }
    function ic(st) { return '<span class="ico ' + st + '">' + (st === 'ok' ? '✓' : st === 'err' ? '✕' : '!') + '</span>'; }

    h += '<details class="blk"><summary><h3>Lotes do PSCF (' + lotRows.length + ')</h3></summary><div class="tw"><table><thead><tr><th></th><th>Documento</th><th>Lote</th><th class="n">Vol.</th><th class="n">Peso líq.</th><th>Rótulo</th><th>Item</th><th>Observação</th></tr></thead><tbody>' +
      lotRows.map(function (r) { var l = r.l, tp = l.cert ? TYPES[r.doc ? r.doc.type : tipoNum(l.cert)] : ''; var rot = r.row && r.row.rotulo && r.row.rotulo !== l.rotulo ? l.rotulo + ' × ' + r.row.rotulo : l.rotulo;
        return '<tr class="' + (r.st === 'err' ? 'bad' : r.st === 'warn' ? 'wrn' : '') + '"><td>' + ic(r.st) + '</td><td class="mono"><span class="tag eq">' + esc(tp) + '</span> ' + esc(l.cert || '—') + '</td><td class="mono">' + esc(l.lote) + '</td><td class="n">' + fmtN(l.vol) + '</td><td class="n">' + fmtN(l.pl, 3) + '</td><td class="mono">' + esc(rot) + '</td><td>' + esc(r.row ? r.row.label : '—') + '</td><td>' + esc(r.msg || '') + '</td></tr>'; }).join('') + '</tbody></table></div></details>';

    if (A) h += '<details class="blk"><summary><h3>PSCF × Anexo IV (por SIF e lote)</h3></summary><div class="tw"><table><thead><tr><th></th><th>SIF</th><th>Lote</th><th class="n">Vol. PSCF</th><th class="n">Vol. Anexo</th><th class="n">Peso líq. PSCF</th><th class="n">Peso líq. Anexo</th><th>Observação</th></tr></thead><tbody>' +
      axRows.map(function (r) { return '<tr class="' + (r.st === 'err' ? 'bad' : '') + '"><td>' + ic(r.st) + '</td><td>' + esc(r.sif) + '</td><td class="mono">' + esc(r.lote) + '</td><td class="n">' + (r.p ? fmtN(r.p.vol) : '—') + '</td><td class="n">' + (r.a ? fmtN(r.a.vol) : '—') + '</td><td class="n">' + (r.p ? fmtN(r.p.pl, 3) : '—') + '</td><td class="n">' + (r.a ? fmtN(r.a.pl, 3) : '—') + '</td><td>' + esc(r.msg) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' + (A.prods.length ? '<p class="sub" style="margin-top:8px">Certificados declarados no Anexo IV: ' + A.prods.map(function (p) { return 'produto ' + p.n + ' (SIF ' + esc(p.sif) + '): ' + p.certs.map(function (c) { return esc(c.num) + ' [' + c.col + ']'; }).join(', '); }).join(' · ') + '</p>' : '') + '</details>';

    resp.forEach(function (f) {
      var D = f.parsed;
      h += '<details class="blk"><summary><h3>' + esc(TYPES[f.type]) + ' ' + esc(f.numero || '(nº não lido)') + (f.pages.some(function (p) { return p.ocr; }) ? ' <span class="tag warn">OCR</span>' : '') + '</h3></summary>' +
        '<p class="sub">' + esc(f.name) + (D.destSif ? ' · destinatário SIF ' + esc(D.destSif) : '') + (D.destField ? ' · país de destino: ' + esc(D.destField) : '') + (D.habilDoc.length ? ' · países: ' + esc(D.habilDoc.join(', ')) : '') + '</p>' +
        '<div class="tw"><table><thead><tr><th>Item</th><th>Produto</th><th>Rótulo</th><th>Lotes lidos</th><th class="n">Vol.</th><th class="n">Peso líq.</th><th>Habilitação</th></tr></thead><tbody>' +
        (D.rows.length ? D.rows.map(function (r) { var hb = habilOf(f, r); return '<tr><td>' + esc(r.label) + '</td><td>' + esc(r.name) + '</td><td class="mono">' + esc(r.rotulo || '—') + '</td><td class="mono">' + esc(Array.from(r.lots).join(' ')) + '</td><td class="n">' + fmtN(r.vol) + '</td><td class="n">' + fmtN(r.peso, 2) + '</td><td>' + esc(hb.list.join(', ') || '—') + '</td></tr>'; }).join('') : '<tr><td colspan="7">Não encontrei a tabela de produtos. Lotes no documento: ' + esc(Array.from(D.allLots).join(' ') || 'nenhum') + '</td></tr>') +
        '</tbody></table></div><details style="margin-top:10px;box-shadow:none;padding:0"><summary class="sub">Ver texto lido</summary><pre class="raw">' + esc(D.text) + '</pre></details></details>';
    });
    $('out').innerHTML = h; var pb = $('prt'); if (pb) pb.onclick = function () { window.print(); };
    $('out').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  render();
  window.__hub = { files: function () { return files; }, analyse: analyse, parseRespaldo: parseRespaldo, regra: regra, checaHab: checaHab, regraTxt: regraTxt };
})();
