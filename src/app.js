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
      return rec(c, sc);
    }
    async function rec(c, sc) {
      var w = await get();
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
    return { page: page, canvas: rec };
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

  async function readImg(f, onProg) {
    onProg(0.05, 'Lendo a foto com OCR');
    var bmp = await createImageBitmap(f.file), sc = Math.min(1, 3600 / Math.max(bmp.width, bmp.height));
    var c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    var w = c.width, h = c.height, words = await OCR.canvas(c, 1); onProg(1, 'Foto lida');
    return [{ n: 1, w: w, h: h, ocr: true, img: true, lines: toLines(words), words: words }];
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

  function classify(text, nome) {
    var U = norm(text), N = norm(nome || '');
    // HashData: o título pode quebrar a linha, o nome do usuário no topo muda ("Quali9", "Qualidade"...) e às vezes vem sem numeração.
    // Reconhece pelo conjunto de sinais do formulário, não por uma palavra só.
    var U1 = U.replace(/\s+/g, ' '), N1 = N.replace(/[_\s]+/g, ' ');
    if (/GUIA DE CARREGAMENTO DE MERCADORIAS|HASHDATA|PLAN_?CD_?ITJ_?036/.test(U1) || /GUIA DE CARREGAMENTO|HASHDATA|PLAN CD ITJ 036/.test(N1)) return 'hashdata';
    var SINAIS = [/PERGUNTA\s+RESPOSTA/, /CRIACAO NO DISPOSITIVO/, /RECEBIMENTO NO SERVIDOR/, /OC\.?\s*PSCF/, /N[°º]?\s*DO CONT(E|A)INER/, /LACRE SIF/, /TEMPERATURA INICIO/, /TEMPERATURA FIM/, /TERMOGRAFO/, /ORDEM DE CARGA/, /\b\d+\s+IMAGE(M|NS)\b/, /RESPONSAVEIS PELA AVALIACAO/, /INICIO DA VERIFICACAO DO VEICULO/, /FECHAMENTO DAS? PORTAS?/, /TIPO DE VEICULO/];
    if (!/CERTIFICADO SANITARIO|DECLARACAO DE PRODUTOS DE ORIGEM|RELATORIO DE CARGA|DANFE/.test(U1) && SINAIS.filter(function (r) { return r.test(U1); }).length >= 4) return 'hashdata';
    if (/DECLARACAO DE PRODUTOS DE ORIGEM ANIMAL/.test(U)) return /FINALIDADE DA DCPOA\s*:\s*SOLICITACAO|SOLICITACAO DE CERTIFICADO SANITARIO/.test(U) ? 'dcpoanova' : 'dcpoa';
    if (/DETALHES DO DOCUMENTO DE TRANSITO/.test(U)) return 'sigsif';
    if (/DANFE|DOCUMENTO AUXILIAR DA NOTA FISCAL/.test(U)) return 'nf';
    if (/CROQUI/.test(N) || (/ETIQUETA PRIMARIA|EMBALAGEM PRIMARIA/.test(U) && /ETIQUETA SECUNDARIA/.test(U))) return 'croqui';
    if (/ESTABELECIMENTO NACIONAL/.test(U) && /PRODUTOS HABILITADOS/.test(U)) return 'ficha';
    if (/PSCF\s*7446|ORDEM CARREGAMENTO/.test(U)) return 'pscf';
    if (/ANEXO IV/.test(U) && /RELATORIO DE CARGA/.test(U)) return 'anexo4';
    if (/CERTIFICADO SANITARIO NACIONAL/.test(U)) return 'csn';
    if (/DECLARACAO DE CONFORMIDADE|DCPOA/.test(U.slice(0, 1500))) return 'dcpoa';
    if (/CERTIFICADO SANITARIO|CERTIFICADO ZOOSANITARIO|HEALTH CERTIFICATE|CERTIFICADO SANITARIO PARA EXPORTA/.test(U)) return 'csi';
    if (/SIGSIF/.test(U.slice(0, 1500))) return 'sigsif';
    return 'outro';
  }
  var TYPES = { pscf: 'Relatório PSCF 7446', anexo4: 'Anexo IV', csn: 'CSN', csi: 'CSI', dcpoa: 'DCPOA', sigsif: 'SIGSIF', hashdata: 'HashData (guia de carregamento)', dcpoanova: 'DCPOA emitida', sigsifexp: 'SIGSIF da exportação', nf: 'Nota fiscal', croqui: 'Croqui', ficha: 'Ficha do SIF', outro: 'Não reconhecido' };
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
    pages.forEach(function (pg) { pg.lines.forEach(function (L, li) {
      var t = L.text, U = norm(t), m;
      if (L._junta) return;
      // número do certificado quebrado em duas linhas ("N0-" / "00598842/3837/26")
      var nx = pg.lines[li + 1];
      if (/(?:^|\s)[A-Z0-9]{2}-\s+\d{2}\/\d{2}\/\d{4}/.test(U) && nx && (m = /^\s*(\d{8}\/[A-Z0-9-]{2,8}\/\d{2})\s*$/.exec(norm(nx.text)))) { t = t.replace(/([A-Z0-9]{2}-)(\s+\d{2}\/)/i, '$1' + m[1] + '$2'); U = norm(t); nx._junta = true; }
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
    cargaInfo(R, pages);
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
        var rd = /(?:^|[^\d\/])(\d{6}\/\d{2,5}\/\d{2})(?![\d\/])/g;
        while ((mm = rd.exec(s))) { var dn = mm[1], dk = certKey(dn);
          if (!cur.certs.some(function (c) { return c.key === dk; })) cur.certs.push({ num: dn, key: dk, col: 'DCPOA' }); }
      });
      if ((m = ROW.exec(L.text))) {
        if (m[1]) prodSif = m[1];
        if (!cur.sif && prodSif) cur.sif = prodSif;
        cur.lots.push({ sif: prodSif || cur.sif, lote: m[2], dtProd: dmy(m[3]), dtVal: dmy(m[4]), vol: parseNum(m[6], true), pb: parseNum(m[7], true), pl: parseNum(m[8], true) });
      }
    }); });
    cargaInfo(A, pages);
    return A;
  }
  // container e data de carregamento: procura o rótulo e o valor perto dele (linha ou célula seguinte)
  function cargaInfo(R, pages) {
    var flat = norm(pages.map(function (p) { return p.lines.map(function (l) { return l.text; }).join(' \n '); }).join(' \n ')).replace(/[ \t]+/g, ' '), m;
    if ((m = /INICIO CARREG\.?\s*:\s*(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}))?/.exec(flat))) { R.dtCarreg = m[1]; R.hrIni = m[2] || ''; }
    if ((m = /FIM CARREG\.?\s*:\s*(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}))?/.exec(flat))) { R.dtFim = m[1]; R.hrFim = m[2] || ''; }
    if ((m = /LACRE OFICIAL[^:]*:\s*(\d{3,8}\s*\/\s*SIF\s*\d{2,5})/.exec(flat))) R.lacre = m[1].replace(/\s/g, '');
    if ((m = /TEMPERATURA INICIO\s*:\s*(-?\d+,\d+)/.exec(flat))) R.tIni = m[1];
    if ((m = /TEMPERATURA MEIO\s*:\s*(-?\d+,\d+)/.exec(flat))) R.tMeio = m[1];
    if ((m = /TEMPERATURA FINAL\s*:\s*(-?\d+,\d+)/.exec(flat))) R.tFim = m[1];
    if ((m = /TERMOGRAFO\s*:?\s*([A-Z]{2,5}\d{6,14})/.exec(flat))) R.termografo = m[1];
    if ((m = /TOTAL DOS ITENS DA CARGA\s*:\s*([\d.]+)\s+([\d.]+,\d{3})/.exec(flat))) { R.totVol = parseNum(m[1], true); R.totPL = parseNum(m[2], true); }
    if ((m = /CONT(?:A|E)INER\W{0,12}?([A-Z]{4}\s?-?\s?\d{6}\s?-?\s?\d)\b/.exec(flat))) R.container = m[1].replace(/[\s-]/g, '');
    else if ((m = /CONT(?:A|E)INER\s*(?:N[º°O]\.?)?\s*:\s*([A-Z0-9][A-Z0-9-]{5,14})\b/.exec(flat)) && /\d/.test(m[1])) R.container = m[1];
    if (R.dtCarreg) {} else if ((m = /CARREGAMENTO\W{0,25}?(\d{2}\/\d{2}\/\d{2,4})/.exec(flat))) R.dtCarreg = m[1];
    else if ((m = /(?:DATA|DT\.?)\s*(?:DE|DO)?\s*(?:EMBARQUE|ESTUFAGEM)\W{0,25}?(\d{2}\/\d{2}\/\d{2,4})/.exec(flat))) R.dtCarreg = m[1];
  }


  /* ---------- DCPOA (respaldo e nova), HashData, SIGSIF da exportação, NF ---------- */
  function linhasDe(pages) { var a = []; pages.forEach(function (p) { p.lines.forEach(function (l) { a.push(l); }); }); return a; }
  function plano(pages) { return norm(linhasDe(pages).map(function (l) { return l.text; }).join(' \n ')).replace(/[ \t]+/g, ' '); }
  function ano4(d) { var m = /(\d{2})\/(\d{2})\/(\d{2,4})/.exec(d || ''); return m ? m[1] + '/' + m[2] + '/' + (m[3].length === 2 ? '20' + m[3] : m[3]) : ''; }
  function valorApos(L, i, re) { for (var k = i + 1; k < Math.min(L.length, i + 4); k++) if (re.test(norm(L[k].text))) return norm(L[k].text); return ''; }
  function parseDcpoa(pages) {
    var L = linhasDe(pages), F = plano(pages), m, D = { prods: [], destinos: {}, temps: {}, croquis: [], nfs: [], transito: [] };
    if ((m = /N[º°O]\s*(\d{6}\/\d{2,5}\/\d{2})/.exec(F))) D.numero = m[1];
    if ((m = /SUBSTITUI A DE NUMERO\s*(\d{6}\/\d{2,5}\/\d{2})/.exec(F))) D.substitui = m[1];
    if ((m = /1\.\s*N[º°O] DE REGISTRO[^:]*SIF N[º°O]\s*:\s*(\d{2,5})/.exec(F))) D.sifExp = m[1];
    if ((m = /FINALIDADE DA DCPOA\s*:\s*([^.\n]+)/.exec(F))) D.finalidade = m[1].trim();
    L.forEach(function (l, i) { var U = norm(l.text), v;
      if (/3\.1\.?\s*DATA/.test(U) && (v = valorApos(L, i, /\d{2}\/\d{2}\/\d{4}/))) { var a = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+(\S+)\s+(.*)$/.exec(v);
        if (a) { D.verifData = a[1]; D.verifHora = a[2]; D.placa = a[3]; var c = /([A-Z]{4}\s?\d{6}\s?-?\d)/.exec(a[4]); D.contentor = c ? c[1].replace(/[\s-]/g, '') : (/NAO APLICAVEL/.test(a[4]) ? 'NÃO APLICÁVEL' : ''); } }
      if (/4\.1\.?\s*DATA DE INICIO/.test(U) && (v = valorApos(L, i, /\d{2}\/\d{2}\/\d{4}/))) { var b = v.match(/\d{2}\/\d{2}\/\d{4}/g) || []; D.iniData = b[0]; D.fimData = b[1]; D.lacData = b[2]; var lc = /(\d{3,8}\s*\/\s*SIF\s*\d{2,5})/.exec(v); if (lc) D.lacre = lc[1].replace(/\s/g, ''); }
      if (/4\.1\.1\.?\s*HORARIO/.test(U) && (v = valorApos(L, i, /\d{2}:\d{2}/))) { var h = v.match(/\d{2}:\d{2}/g) || []; D.iniHora = h[0]; D.fimHora = h[1]; D.lacHora = h[2]; }
    });
    // 11. destino dos produtos (só a coluna da esquerda, antes do item 12)
    var i11 = L.findIndex(function (l) { return /11\.\s*DESTINO DOS PRODUTOS/.test(norm(l.text)); });
    if (i11 >= 0) { var w12 = null; for (var k = i11; k < Math.min(L.length, i11 + 3) && w12 == null; k++) L[k].words.forEach(function (w) { if (w12 == null && /^12\.(\s|$)/.test(w.str.trim())) w12 = w.x0; });
      var txt = ''; for (k = i11 + 1; k < Math.min(L.length, i11 + 12); k++) { var U2 = norm(L[k].text); if (/DCPOA VERSAO|13\.\s*RASTREAB/.test(U2)) break; txt += ' ' + L[k].words.filter(function (w) { return w12 == null || w.x0 < w12 - 4; }).map(function (w) { return w.str; }).join(' '); }
      var re = /PRODUTO\s*(\d)\s*:\s*(.*?)(?=PRODUTO\s*\d\s*:|$)/g; txt = norm(txt); while ((m = re.exec(txt))) { var d = m[2].replace(/PARA OS DESTINOS PRETENDIDOS\??|\b(SIM|NAO)\s*$/g, ' ').replace(/\s+/g, ' ').trim(); if (d && !/^-+$/.test(d)) D.destinos[m[1]] = d; } }
    // 13. rastreabilidade
    var cur = null;
    L.forEach(function (l) { var U = norm(l.text), a;
      if ((a = /NOMENCLATURA\s*:\s*(.*?)\s*LOTE\s*:\s*(.*)$/.exec(U))) { cur = { n: String(D.prods.length + 1), nome: a[1].trim(), lotesTxt: a[2].trim(), lotes: (a[2].match(/\d{8}/g) || []) }; if (/^-+$/.test(cur.nome) || !cur.nome) { cur = null; return; } D.prods.push(cur); return; }
      if (cur && !cur.rotulo && (a = /^(?:\d\.\s*)?(\d{4}\/\d{2,5})\s+(.+?)\s+(\d{3,})\s+(\d{2}\/\d{2}\/\d{2})\s*-\s*(\d{2}\/\d{2}\/\d{2})\s+(\d{2}\/\d{2}\/\d{2})\s*-\s*(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+([\d.]+)\s+([\d.]+,\d{3})\s*KG/.exec(U))) {
        cur.rotulo = a[1]; cur.marca = a[2].trim(); cur.codigo = a[3]; cur.prodIni = ano4(a[4]); cur.prodFim = ano4(a[5]); cur.valIni = ano4(a[6]); cur.valFim = ano4(a[7]); cur.natureza = a[8]; cur.vol = parseNum(a[9], true); cur.peso = parseNum(a[10], true); }
    });
    if ((m = /\bTOTAL\s+(\d[\d.]*)\s+([\d.]+,\d{3})/.exec(F))) { D.totVol = parseNum(m[1], true); D.totPeso = parseNum(m[2], true); }
    var tr = /PRODUTO\s*(\d)\s+(-?\d+,\d+)\s+(-?\d+,\d+)\s+(-?\d+,\d+)\s+(-?\d+,\d+)/g; while ((m = tr.exec(F))) D.temps[m[1]] = { ini: m[2], meio: m[3], fim: m[4], reg: m[5] };
    var rs = (/DOCUMENTOS DE RESPALDO[^:]*:(.*?)DECLARO/.exec(F.replace(/\n/g, ' ')) || [])[1] || ''; D.respaldoTxt = rs.trim();
    var cq = /CROQUI\s*:\s*(\d{4}\/\d{2,5})/g; while ((m = cq.exec(rs))) D.croquis.push(m[1]);
    var nf = /NOTA FISCAL\s*:\s*(\d{3,9})/g; while ((m = nf.exec(rs))) D.nfs.push(m[1]);
    if ((m = /ANEXO IV\s*-?\s*N[º°O]?\s*([\d\s\/]+\d)/.exec(rs))) D.anexo4 = m[1].replace(/\s/g, '');
    var tt = /DCPOA DE TRANSITO\s*(?:N[º°O]\s*)?(\d{6}\/\d{2,5}\/\d{2})/g, FF = F.replace(/\n/g, ' '); while ((m = tt.exec(FF))) D.transito.push(m[1]);
    D.oficio = (/OFICIO[- ]CIRCULAR[^.]{0,60}/.exec(FF) || [''])[0].trim();
    D.lotesNoAnexo = /LOTES DESCRITOS NO RELATORIO DE RASTREABILIDADE|LOTES? DESCRITOS? NO ANEXO IV/.test(FF);
    return D;
  }
  // HashData (guia de carregamento): pergunta → resposta, com a página de cada pergunta (para achar as fotos)
  function parseHash(pages) {
    var H = { qa: {}, pagQ: {}, lista: [] }, ax = null;
    // coluna da resposta: onde começa a palavra que vem depois de um vão largo nas linhas "N. pergunta   resposta"
    var cands = []; pages.forEach(function (pg) { pg.lines.forEach(function (l) { if (l.words.length < 2 || l.words[0].x0 > (pg.w || 600) * 0.2) return;
      for (var q = 1; q < l.words.length; q++) if (l.words[q].x0 - l.words[q - 1].x1 > 15 && l.words[q].x0 > (pg.w || 600) * 0.35) { cands.push(l.words[q].x0); break; } }); });
    if (cands.length) ax = Math.min.apply(null, cands) - 4;
    var SKIP = /^(PERGUNTA|CRIACAO NO DISPOSITIVO|RECEBIMENTO NO SERVIDOR|PLAN_|MERCADORIAS_REV|ACOMPANHAMENTO \(FOLLOW-UP\)|\d+ \/ \d+$)/;
    var ult = null, seq = 0, pend = '', margem;
    pages.forEach(function (pg) {
      margem = (pg.w || 600) * 0.2;
      pg.lines.forEach(function (l) {
        var esq = l.words.filter(function (w) { return ax == null || w.x0 < ax; }).map(function (w) { return w.str; }).join(' ').trim(),
          dir = l.words.filter(function (w) { return ax != null && w.x0 >= ax; }).map(function (w) { return w.str; }).join(' ').trim();
        if (SKIP.test(norm(esq || dir)) || /^PERGUNTA$/.test(norm(esq)) || /^RESPOSTA$/.test(norm(dir))) return;
        var m = /^(\d{1,3})\.\s*(.+)$/.exec(esq);
        if (m) { pend = ''; ult = { n: +m[1], label: m[2].trim(), value: dir, page: pg.n }; H.lista.push(ult); return; }
        var naMargem = l.words.length && l.words[0].x0 <= margem;
        // guia exportado sem numeração: a pergunta fica na coluna da esquerda e a resposta na da direita
        if (esq && dir && naMargem) { ult = { n: 900 + (++seq), semNum: true, label: (pend ? pend + ' ' : '') + esq, value: dir, page: pg.n }; pend = ''; H.lista.push(ult); return; }
        if (!esq && dir && pend) { ult = { n: 900 + (++seq), semNum: true, label: pend, value: dir, page: pg.n }; pend = ''; H.lista.push(ult); return; }
        if (!ult || ult.page !== pg.n) { if (esq && naMargem) pend = (pend ? pend + ' ' : '') + esq; return; }
        if (esq && !dir) {
          if (ult.semNum && ult.value && !/^[a-zà-ú(),]/.test(esq)) pend = (pend ? pend + ' ' : '') + esq; // começo da próxima pergunta
          else if (!/[?:]$/.test(ult.label)) ult.label += ' ' + esq;                                         // pergunta em duas linhas
        }
        else if (dir && !esq && !ult.value) ult.value = dir;                                                  // resposta na linha de baixo
      });
    });
    H.lista.forEach(function (x) { H.qa[x.n] = { q: norm(x.label), a: x.value }; H.pagQ[x.n] = x.page; });
    var ach = function (re, nao) { var x = H.lista.find(function (x) { var q = norm(x.label); return re.test(q) && !(nao && nao.test(q)); }); return x ? x.value : ''; };
    var v = ach;
    H.container = v(/N[°º]?\s*DO CONTEINER|N[°º]?\s*DO CONTAINER/).replace(/[\s-]/g, '');
    H.tipoVeiculo = v(/TIPO DE VEICULO/); H.armador = v(/^ARMADOR/); H.placa = v(/PLACA DA CARRETA|^PLACA/).replace(/[\s-]/g, '');
    H.oc = v(/OC\.?\s*PSCF/); H.ordem = v(/^ORDEM DE CARGA$/); H.destino = v(/^DESTINO$/); H.mercado = v(/^MERCADO$/);
    H.tIni = v(/^TEMPERATURA INICIO/); H.tMeio = v(/^TEMPERATURA MEIO/); H.tFim = v(/^TEMPERATURA FIM/); H.tMedia = v(/MEDIA DAS TEMPERATURAS/);
    H.termografo = v(/NUMERO DO TERMOGRAFO/); H.lacre = v(/LACRE SIF/, /FOTO/).replace(/\s/g, '');
    H.lacreSeara = v(/LACRE (DA )?SEARA/, /FOTO/).replace(/\s/g, ''); H.lacreIntertek = v(/LACRE (DO )?(ARMADOR|INTERTEK)/, /FOTO/).replace(/\s/g, '');
    var dh = function (s) { var m = /(\d{2}\/\d{2}\/\d{4}),?\s*(\d{2}:\d{2})?/.exec(s || ''); return m ? { d: m[1], h: m[2] || '' } : { d: '', h: '' }; };
    H.verif = dh(v(/INICIO DA VERIFICACAO DO VEICULO/)); H.ini = dh(v(/INICIO DO CARREGAMENTO/)); H.fim = dh(v(/FIM DA OPERACAO/));
    return H;
  }
  function parseSigExp(pages) {
    var F = plano(pages).replace(/\n/g, ' '), m, S = { prods: [] };
    var g = function (re) { var x = re.exec(F); return x ? x[1].trim() : ''; };
    S.sif = g(/\bSIF\s*:\s*(\d{2,5})/); S.doc = g(/NR\.? DOCUMENTO DE TRANSITO\s*:\s*([A-Z0-9]{2}-\d{8}\/[A-Z0-9-]+\/\d{2})/); S.modelo = g(/MODELO DOCUMENTO DE TRANSITO\s*:\s*(\S+)/);
    S.ref = g(/NRO\.? REFERENCIA\s*:\s*(\d{6,8}\/\d{2,5}\/\d{4})/); S.dcpoa = g(/DCPOA DE SOLICITACAO\s*:\s*(\d{6}\/\d{2,5}\/\d{2})/);
    S.localData = g(/LOCAL E DATA DE CARREGAMENTO\s+(?!\()(.+?)(?=\s+LOCAL E DATA DE CARREGAMENTO)/); S.data = (/(\d{2}\/\d{2}\/\d{4})/.exec(S.localData) || [])[1] || '';
    var ct = /CONTEINER\(ES\) E LACRE\s+(.+?)(?=\s+ESTABELECIMENTO SOLICITANTE|\s+CODIGO NCM)/.exec(F); S.contLacre = ct ? ct[1] : '';
    S.container = ((/([A-Z]{4}\s?\d{6}\s?-?\d)/.exec(S.contLacre) || [])[1] || '').replace(/[\s-]/g, ''); S.lacre = ((/(\d{3,8}\s*\/\s*SIF\s*\d{2,5})/.exec(S.contLacre) || [])[1] || '').replace(/\s/g, '');
    for (var n = 1; n <= 9; n++) {
      var lt = new RegExp('LOTE E DATA DE PRODUCAO ' + n + '\\s+(?!\\()(.+?)(?=\\s+LOTE E DATA DE PRODUCAO)').exec(F); if (!lt || /^X+$/.test(lt[1].trim())) continue;
      var num = function (rot) { var x = new RegExp(rot + ' ' + n + '\\s+([\\d.,X]+)').exec(F); return x ? x[1] : ''; };
      S.prods.push({ n: n, lotes: lt[1].match(/\d{8}/g) || [], abate: num('ESTABELECIMENTO - ABATE'), proc: num('ESTABELECIMENTO - PROCESSADOR'), arm: num('ESTABELECIMENTO -\\s?ARMAZENADOR'), vol: parseNum(num('NUMERO DE EMBALAGENS'), true), peso: parseNum(num('PESO LIQUIDO \\(KG\\)'), true) });
    }
    if ((m = /TOTAL DE PECAS\s+([\d.]+)/.exec(F))) S.totVol = parseNum(m[1], true);
    if ((m = /PESO LIQUIDO TOTAL\s+([\d.]+,\d{2,3})/.exec(F))) S.totPL = parseNum(m[1], true);
    S.parecer = g(/PARECER DE APROVACAO\s*:\s*([A-Z ]+?)(?=\s+DESCRICAO|$)/);
    return S;
  }
  function parseNF(pages, nome) { var F = plano(pages).replace(/\n/g, ' '), m = /N[º°O]\s*:?\s*(\d{3,9})\b/.exec(F) || /(\d{6,9})\.pdf$/i.exec(nome || '') || /\b(\d{6})\b/.exec(nome || ''); return { numero: m ? String(+m[1]) : '' }; }
  function parseCroqui(pages, nome) { var m = /(?:CROQUI[_ -]*)(\d{4})/i.exec(nome || '') || /\b(\d{4})\s*\/\s*\d{3,5}\b/.exec(plano(pages)); return { rotulo: m ? m[1] : '' }; }

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
  // separa o texto de habilitação por item; devolve { itens: { '1.1': [países] }, todos: [países] }
  function habilPorItem(txt) {
    var out = { itens: {}, todos: [] }; txt = String(txt || '');
    if (!txt || !/\bITE(?:M|NS)\b|\bPRODUTOS?\b/.test(txt)) return out;
    var NUM = '\\d{1,2}(?:\\.\\d{1,2})?', SEP = '\\s*(?:,|\\bE\\b|\\/|\\bA\\b|-(?=\\s*\\d))\\s*', DEC = '\\d{1,2}\\.\\d{1,2}';
    var re = new RegExp('\\bITE(?:M|NS)\\b\\s*(?:N[º°O]\\.?)?\\s*(' + NUM + '(?:' + SEP + NUM + ')*)(?![\\d,])|(?<![\\d.,])(' + DEC + '(?:' + SEP + DEC + ')*)(?![\\d,])', 'g');
    var mk = [], m;
    while ((m = re.exec(txt))) mk.push({ ini: m.index, fim: m.index + m[0].length, nums: m[1] || m[2] });
    if (!mk.length) return out;
    var lab = function (x) { x = x.replace(/\.$/, ''); return x.indexOf('.') >= 0 ? x : '1.' + x; }, todos = new Set();
    mk.forEach(function (k, i) {
      var nums = [];
      k.nums.split(/\s*(?:,|\bE\b|\/)\s*/).forEach(function (t) {
        t = t.trim(); var r = /^(\d{1,2}(?:\.\d{1,2})?)\s*(?:\bA\b|-)\s*(\d{1,2}(?:\.\d{1,2})?)$/.exec(t);
        if (r) { var a = +lab(r[1]).split('.')[1], b = +lab(r[2]).split('.')[1]; for (var q = a; q <= b; q++) nums.push('1.' + q); }
        else if (/^\d/.test(t)) nums.push(lab(t));
      });
      var trecho = txt.slice(k.fim, i + 1 < mk.length ? mk[i + 1].ini : txt.length);
      var ps = paisesDoTexto(trecho);
      if (ps.length) nums.forEach(function (it) { out.itens[it] = (out.itens[it] || []).concat(ps.filter(function (p) { return (out.itens[it] || []).indexOf(p) < 0; })); });
      ps.forEach(function (p) { todos.add(p); });
    });
    out.todos = Array.from(todos); return out;
  }
  // tira os nomes de países de um trecho (com ou sem vírgulas: "FILIPINAS JAPAO", "GEÓRGIA, REPUBLICA DA")
  var PULA = ['E', 'DA', 'DE', 'DO', 'DAS', 'DOS', 'ILHAS', 'ILHA', 'HABILITACAO', 'HABILITACOES', 'HABILITADO', 'HABILITADOS', 'ITEM', 'ITENS', 'PRODUTO', 'PRODUTOS', 'REPUBLICA', 'POPULAR', 'PARA', 'CONFORME', 'PAISES', 'PAIS', 'APENAS', 'SOMENTE'];
  function paisesDoTexto(txt) {
    var w = cl(txt).split(' ').filter(Boolean); if (!w.length) return [];
    var nomes = nomesPaises().slice().sort(function (a, b) { return b.split(' ').length - a.split(' ').length; }), out = [], resto = [];
    var solta = function () { var r = resto.filter(function (x) { return PULA.indexOf(x) < 0 && x.length > 2; }).join(' '); if (r) out.push(r); resto = []; };
    for (var i = 0; i < w.length;) {
      var achou = null;
      for (var j = 0; j < nomes.length && !achou; j++) { var nw = nomes[j].split(' '); if (w.slice(i, i + nw.length).join(' ') === nomes[j]) achou = nomes[j]; }
      if (achou) { solta(); if (out.indexOf(achou) < 0) out.push(achou); i += achou.split(' ').length; }
      else { resto.push(w[i]); i++; }
    }
    solta(); return out;
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
    // habilitação por item: nas Observações ou no cabeçalho ("países/blocos econômicos").
    // Formatos vistos: "ITEM 1.1, 1.2 HABILITAÇÃO: ...", "ITEM 1: JAPÃO; FILIPINAS - ITEM 2, 3 E 4: JAPÃO",
    // "PRODUTO 1.1: ... 1.2: ...", "PRODUTO: 1.1 ... / 1.2 ...", "PRODUTOS : 1.1 FILIPINAS JAPAO 1.2 ..."
    var obs = (/OBSERVACOES\s*:?\s*(.*?)(?=\s+VERIFICAR EM|\s+CODIGO DE AUTENTICIDADE|\s+NOME DO MEDICO|$)/.exec(flat) || [])[1] || '';
    obs = obs.trim(); D.obs = obs; if (/^X+\.?$/.test(obs)) obs = '';
    var cab = ((m = /ECONOMICO\(S\)\s*:\s*(.+?)\s+1\.\s*IDENTIFICA/.exec(flat)) ? m[1] : '').trim();
    var pObs = habilPorItem(obs), pCab = habilPorItem(cab);
    D.habilItens = Object.keys(pObs.itens).length ? pObs.itens : pCab.itens;
    D.habilFonte = Object.keys(pObs.itens).length ? 'Observações' : Object.keys(pCab.itens).length ? 'cabeçalho' : '';
    if (!Object.keys(pObs.itens).length && obs && /HABILITA/.test(obs)) D.habilObs = paisesDoTexto(obs.replace(/^.*?HABILITA\w*\s*:?\s*/, ''));
    D.habilDoc = cab ? (Object.keys(pCab.itens).length ? pCab.todos : paisesDoTexto(cab)) : [];
    D.destField = cleanCountry(findDestField(pages));
    if (type === 'dcpoa' && /DECLARACAO DE PRODUTOS DE ORIGEM ANIMAL/.test(U)) {
      var DP = parseDcpoa(pages); D.dcpoa = DP; if (DP.numero) { D.numero = DP.numero; D.key = certKey(DP.numero); }
      D.habilItens = {}; D.habilFonte = 'destino dos produtos'; D.habilDoc = [];
      Object.keys(DP.destinos).forEach(function (n) { D.habilItens[n] = paisesDoTexto(DP.destinos[n]); D.habilItens[n].forEach(function (c) { if (D.habilDoc.indexOf(c) < 0) D.habilDoc.push(c); }); });
      D.destSif = (/2\.\s*N[º°O] DE REGISTRO[^:]*VIGIAGRO\s*:\s*(\d{2,5})/.exec(flat) || [])[1] || '';
      DP.prods.forEach(function (pr) {
        var meses = []; if (pr.valIni && pr.valFim) { var a = pr.valIni.split('/'), b = pr.valFim.split('/'), y = +a[2], mo = +a[1]; while (y < +b[2] || (y === +b[2] && mo <= +b[1])) { meses.push(('0' + mo).slice(-2) + '/' + y); mo++; if (mo > 12) { mo = 1; y++; } if (meses.length > 36) break; } }
        var dates = parseDates((pr.prodIni ? pr.prodIni + ' A ' + pr.prodFim : '') + ' ' + meses.join(' '));
        D.rows.push({ page: 1, label: pr.n, name: pr.nome, rotulo: pr.rotulo || '', lots: new Set(pr.lotes), dates: dates, restText: '', vol: pr.vol, peso: pr.peso, sifs: [DP.sifExp].filter(Boolean), marca: pr.marca, habil: D.habilItens[pr.n] || null });
      });
      D.rows.forEach(function (r) { r.lots.forEach(function (l) { D.allLots.add(l); }); });
      return D;
    }
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
    if (row && row.habil && row.habil.length) return { list: row.habil, src: (doc.parsed.habilFonte || 'Observações') + ', ' + row.label };
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
    try { if (EXT && EXT.ok) extPreenche(); } catch (e) {}
    var ul = $('flist'); ul.innerHTML = '';
    files.forEach(function (f) {
      var li = document.createElement('li'); li.setAttribute('data-k', f.ext === 'xlsx' ? 'XLSX' : f.ext === 'img' ? 'FOTO' : 'PDF'); if (f.ext === 'xlsx') li.className = 'xls'; if (f.ext === 'img') li.className = 'img';
      var st = f.status === 'lendo' ? '<span class="tag eq">' + esc(f.msg || 'Lendo…') + '</span>' : f.status === 'erro' ? '<span class="tag err">' + esc(f.msg) + '</span>' : '<span class="tag ok">Lido</span>';
      var ocr = f.pages && f.pages.some(function (p) { return p.ocr; }) ? ' <span class="tag warn">OCR</span>' : '';
      var sel = '<select data-id="' + f.id + '" class="ty">' + Object.keys(TYPES).map(function (k) { return '<option value="' + k + '"' + (f.type === k ? ' selected' : '') + '>' + TYPES[k] + '</option>'; }).join('') + '</select>';
      var num = isResp(f.type) ? ' Nº <input data-id="' + f.id + '" class="nu" value="' + esc(f.numero || '') + '" placeholder="não lido">' : '';
      li.innerHTML = '<div class="name">' + esc(f.name) + '</div><div class="fbtn"><button class="xdl" title="Baixar este arquivo" data-id="' + f.id + '"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg></button><button class="xrm" title="Remover" data-id="' + f.id + '">×</button></div>' +
        '<div class="meta">' + st + ocr + (f.status === 'ok' ? sel + num + (f.pages ? '<span>' + f.pages.length + ' pág.</span>' : '') : '') + '</div>' +
        (f.status === 'lendo' ? '<div class="bar"><i style="width:' + Math.round((f.prog || 0) * 100) + '%"></i></div>' : '');
      ul.appendChild(li);
    });
    $('run').disabled = !files.length || files.some(function (f) { return f.status === 'lendo'; });
  }
  $('flist').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var id = b.getAttribute('data-id');
    if (b.classList.contains('xrm')) { files = files.filter(function (f) { return String(f.id) !== id; }); render(); }
    if (b.classList.contains('xdl')) { var f = files.find(function (x) { return String(x.id) === id; }); if (f) baixar(f.file, f.name); } });
  $('flist').addEventListener('change', function (e) {
    var id = e.target.getAttribute('data-id'), f = files.find(function (x) { return String(x.id) === id; }); if (!f) return;
    if (e.target.classList.contains('ty')) { f.type = e.target.value; prepare(f); render(); }
    if (e.target.classList.contains('nu')) { f.numero = e.target.value.trim(); f.key = certKey(f.numero); f.manualNum = true; }
  });
  function prepare(f) {
    f.extra = null;
    if (f.type === 'hashdata') f.extra = parseHash(f.pages);
    if (f.type === 'dcpoanova') { f.extra = parseDcpoa(f.pages); f.numero = f.extra.numero || ''; }
    if (f.type === 'sigsifexp' || f.type === 'sigsif') { var sx = parseSigExp(f.pages); if (f.type === 'sigsifexp') f.extra = sx; f.sigx = sx; }
    if (f.type === 'nf') { f.extra = parseNF(f.pages, f.name); f.numero = f.extra.numero; }
    if (f.type === 'croqui') f.extra = parseCroqui(f.pages, f.name);
    if (isResp(f.type)) { f.parsed = parseRespaldo(f.pages, f.type); if (!f.manualNum) { f.numero = f.parsed.numero; f.key = f.parsed.key; } }
  }
  var queue = Promise.resolve();
  function addFiles(list) {
    Array.prototype.forEach.call(list, function (file) {
      var ext = /\.xls[xm]$/i.test(file.name) ? 'xlsx' : /\.pdf$/i.test(file.name) ? 'pdf' : /\.(jpe?g|png|webp|bmp)$/i.test(file.name) ? 'img' : '';
      if (!ext) return;
      var f = { id: ++seq, file: file, name: file.name, ext: ext, status: 'lendo', prog: 0, msg: 'Na fila' };
      files.push(f);
      queue = queue.then(async function () {
        try {
          f.msg = 'Lendo…'; render();
          f.pages = ext === 'xlsx' ? await readXlsx(f) : ext === 'img' ? await readImg(f, function (p, m) { f.prog = p; f.msg = m; render(); }) : await readPdf(f, function (p, m) { f.prog = p; f.msg = m; render(); }, $('forceocr').checked);
          var txt = f.pages.map(function (p) { return p.lines.map(function (l) { return l.text; }).join('\n'); }).join('\n');
          f.type = classify(txt, f.name); f.status = 'ok'; prepare(f);
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
    var A0 = anxF ? parseAnexo(anxF.pages) : null, mudou = false;
    files.forEach(function (f) { if (f.type === 'sigsif' && f.sigx && A0 && ((f.sigx.ref && f.sigx.ref.replace(/\D/g, '') === (A0.sigsif || '').replace(/\D/g, '')) || (f.sigx.sif && f.sigx.sif === A0.sif))) { f.type = 'sigsifexp'; prepare(f); mudou = true; } });
    if (mudou) render();
    var resp = files.filter(function (f) { return isResp(f.type) && f.status === 'ok'; });
    var EXP = { H: null, N: null, S: null, nf: [], croqui: [], fH: null };
    files.forEach(function (f) { if (f.status !== 'ok' || !f.extra) return; if (f.type === 'hashdata' && !EXP.H) { EXP.H = f.extra; EXP.fH = f; } if (f.type === 'dcpoanova' && !EXP.N) EXP.N = f.extra; if (f.type === 'sigsifexp' && !EXP.S) EXP.S = f.extra; if (f.type === 'nf') EXP.nf.push(f.extra); if (f.type === 'croqui') EXP.croqui.push(f.extra); });
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
      if ((doc.type === 'csn' || doc.type === 'dcpoa') && D.destSif && A && A.sif && D.destSif !== A.sif) E(cert + ': destinatário é o SIF ' + D.destSif + ', mas a carga sai do SIF ' + A.sif + '.', 'Confira se o ' + tipo + ' é mesmo o respaldo deste armazenador.');
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
        if (row && row.habilFalta) probs.push('o item ' + row.label + ' não aparece na habilitação por item do documento (' + (D.habilFonte || 'Observações') + '; itens citados: ' + row.habilFalta + ')');
        else if (destino) { var ch = checaHab(rgOf(l), h.list, doc.type, doc);
          var lib = doc.type === 'dcpoa' && EXP.N && EXP.N.oficio && EXP.N.transito.some(function (t) { return certKey(t) === doc.key; });
          if (lib) ch.probs = ch.probs.filter(function (x) { if (/NAO PODE SER DCPOA DE TRANSITO/.test(norm(x))) { warns.push('DCPOA de trânsito em destino que exige habilitação: a DCPOA emitida cita o ' + EXP.N.oficio.replace(/\s+/g, ' ') + '; confirmar se o produto e o destino estão cobertos'); return false; } return true; });
          ch.probs.forEach(function (x) { probs.push(x); }); ch.warns.forEach(function (x) { if (warns.indexOf(x) < 0) warns.push(x); }); }
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

    var GRADE = confereExportacao(P, A, EXP, E, W);
    paint(P, A, issues, lotRows, axRows, resp, RG, GRADE, EXP);
  }

  function paint(P, A, issues, lotRows, axRows, resp, RG, GRADE, EXP) {
    var nE = issues.filter(function (i) { return i.k === 'err'; }).length, nW = issues.length - nE;
    var nOk = lotRows.filter(function (r) { return r.st === 'ok'; }).length;
    var h = (ULT ? '<div class="pmsg noprint ' + (ULT.k === 'ok' ? 'ok' : '') + '" style="margin-bottom:12px">' + esc(ULT.t) + (ULT.d ? '<small>' + esc(ULT.d) + '</small>' : '') + '</div>' : '') + '<div class="sum">'; ULT = null;
    h += '<div class="kpi ' + (nE ? 'err' : 'ok') + '"><b>' + nE + '</b><span>divergência' + (nE === 1 ? '' : 's') + '</span></div>' +
      '<div class="kpi warn"><b>' + nW + '</b><span>aviso' + (nW === 1 ? '' : 's') + ' para olhar</span></div>' +
      '<div class="kpi ok"><b>' + nOk + '/' + lotRows.length + '</b><span>lotes do PSCF conferidos sem problema</span></div></div>';
    var sifs = Array.from(new Set(P.lines.map(function (l) { return l.sif; }).concat(A ? A.prods.map(function (p) { return p.sif; }) : []).filter(Boolean))).sort(function (a, b) { return a - b; });
    var cont = P.container || (A && A.container) || '', dtc = P.dtCarreg || (A && A.dtCarreg) || '';
    var dq = function (t, v) { return '<div><span>' + t + '</span>' + (v ? '<b>' + esc(v) + '</b>' : '<b class="vazio">não encontrado</b>') + '</div>'; };
    // O.C. de exportação = número da LCAT (referência do PSCF) / relatório de embarque do Anexo IV; a O.C. do PSCF é outra
    var ocExp = ((/LCAT\D{0,5}(\d{5,9})/i.exec(P.ref || '') || /(\d{6,9})/.exec(P.ref || '') || [])[1]) || (A && A.embarque) || '';
    CARGA = { oc: ocExp, ocPscf: P.oc, ref: P.ref, destino: P.destino || (A && A.destino) || '', container: cont, dtCarreg: dtc };
    h += '<div class="panel"><div class="phead"></div><div class="dq">' + dq('O.C. de exportação', ocExp) + dq('Container', cont) + dq('Data de carregamento', dtc) + dq('SIF da carga', sifs.join(' · ')) + '</div>' +
      '<div class="ctx"><span>Destino: <b>' + esc(P.destino || (A && A.destino) || '—') + '</b></span><span>Referência: <b>' + esc(P.ref || '—') + '</b></span>' + (P.oc ? '<span>O.C. do PSCF: <b>' + esc(P.oc) + '</b></span>' : '') +
      (A ? '<span>Anexo IV: <b>' + esc(A.numero || '—') + '</b></span><span>Sai do SIF: <b>' + esc(A.sif || '—') + '</b></span>' : '') + '</div>';
    var SPN = { AVES: 'aves', BOVIN: 'bovinos', SUIN: 'suínos', PESCADO: 'pescado', OVO: 'ovos', LACTEO: 'lácteos', MEL: 'mel' }, vistos = {};
    Object.keys(RG || {}).forEach(function (d) { var R = RG[d], sp = (R.sp || []).map(function (x) { return SPN[x]; }).join(', '), t = regraTxt(R), kk = (R.pais || R.destino) + sp + t + R.epoa + R.epoaOk; if (vistos[kk]) return; vistos[kk] = 1;
      var ent = R.epoa === 'hab' ? (R.epoaOk ? ' · entreposto ' + esc(A && A.sif ? 'SIF ' + A.sif : '') + ' habilitado ✓' : ' · entreposto precisa de habilitação') : R.epoa === 'nao' ? ' · não aceita entreposto' : '';
      h += '<div class="rule" title="Manual CCS · tabela DHC de ' + esc(HB ? HB.dt : '') + '. Casos liberados pelo MAPA não estão na tabela."><b>' + esc(R.pais || R.destino) + (sp ? ' · ' + esc(sp) : '') + '</b>: ' + esc(t) + ent + '</div>'; });
    var errs = issues.filter(function (i) { return i.k === 'err'; }), wrs = issues.filter(function (i) { return i.k === 'warn'; });
    if (!issues.length) h += '<div class="allok">Tudo confere entre PSCF, Anexo IV e os documentos de respaldo.</div>';
    if (errs.length) h += '<h2>Divergências</h2><ul class="issues">' + errs.map(li).join('') + '</ul>';
    if (issues.some(function (i) { return /não foi carregado\.$/.test(i.t); })) h += '<div class="row noprint" style="margin-top:10px"><span class="sub">Faltam respaldos? A ferramenta procura pelo número no nome do arquivo, traz para a lista e confere de novo.</span><div><button class="btn ghost" id="pasta2">Buscar os que faltam na pasta</button></div></div><div class="sub noprint" style="margin-top:4px;text-align:right;font-size:12.5px">ou arraste a pasta do Explorador de Arquivos para esta página</div><div id="pastaMsg2" class="pmsg noprint hide"></div>';
    if (wrs.length) h += '<h2 style="margin-top:16px">Avisos</h2><ul class="issues">' + wrs.map(li).join('') + '</ul>';
    var nomeSalvo = ''; try { nomeSalvo = localStorage.getItem('hub-nome') || ''; } catch (e) {}
    h += '<div class="tools"><label class="nome">Conferido por <input id="nome" placeholder="seu nome" value="' + esc(nomeSalvo) + '" autocomplete="name"></label>' +
      '<button class="btn ghost" id="expAll">Expandir tudo</button><button class="btn ghost" id="colAll">Recolher tudo</button>' +
      '<button class="btn ghost" id="prt">Imprimir / salvar PDF</button><button class="btn ghost" id="dlPage">Baixar página</button><button class="btn" id="dlZip">Baixar compilado (.zip)</button>' +
      '<div class="aviso hide" id="nomeAviso">Preencha o seu nome: ele vai na marca d\'água.</div></div></div>';
    function li(i) { return '<li class="' + i.k + '"><span class="w">' + (i.k === 'err' ? '✕' : '!') + '</span>' + esc(i.t) + (i.d ? '<small>' + esc(i.d) + '</small>' : '') + '</li>'; }
    function ic(st) { return '<span class="ico ' + st + '">' + (st === 'ok' ? '✓' : st === 'err' ? '✕' : '!') + '</span>'; }

    if (GRADE && GRADE.rows.length) h += blocoExportacao(GRADE, EXP);
    var COR = {}, nc = 0, cor = function (num) { var k = certKey(num); if (!k) return 'c0'; if (COR[k] == null) COR[k] = nc++ % 12; return 'c' + COR[k]; };
    lotRows.forEach(function (r) { if (r.l.cert) cor(r.l.cert); }); resp.forEach(function (f) { if (f.numero) cor(f.numero); });
    h += '<details class="blk"><summary><h3>Lotes do PSCF (' + lotRows.length + ')</h3></summary><div class="tw"><table><thead><tr><th></th><th>Documento</th><th>Lote</th><th class="n">Vol.</th><th class="n">Peso líq.</th><th>Rótulo</th><th>Item</th><th>Observação</th></tr></thead><tbody>' +
      lotRows.map(function (r) { var l = r.l, tp = l.cert ? TYPES[r.doc ? r.doc.type : tipoNum(l.cert)] : ''; var rot = r.row && r.row.rotulo && r.row.rotulo !== l.rotulo ? l.rotulo + ' × ' + r.row.rotulo : l.rotulo;
        return '<tr class="' + (r.st === 'err' ? 'bad' : r.st === 'warn' ? 'wrn' : '') + '"><td>' + ic(r.st) + '</td><td class="mono">' + (l.cert ? '<span class="doc ' + cor(l.cert) + '"><span class="tag">' + esc(tp) + '</span> ' + esc(l.cert) + '</span>' : '—') + '</td><td class="mono">' + esc(l.lote) + '</td><td class="n">' + fmtN(l.vol) + '</td><td class="n">' + fmtN(l.pl, 3) + '</td><td class="mono">' + esc(rot) + '</td><td>' + esc(r.row ? r.row.label : '—') + '</td><td>' + esc(r.msg || '') + '</td></tr>'; }).join('') + '</tbody></table></div></details>';

    if (A) h += '<details class="blk"><summary><h3>PSCF × Anexo IV (por SIF e lote)</h3></summary><div class="tw"><table><thead><tr><th></th><th>SIF</th><th>Lote</th><th class="n">Vol. PSCF</th><th class="n">Vol. Anexo</th><th class="n">Peso líq. PSCF</th><th class="n">Peso líq. Anexo</th><th>Observação</th></tr></thead><tbody>' +
      axRows.map(function (r) { return '<tr class="' + (r.st === 'err' ? 'bad' : '') + '"><td>' + ic(r.st) + '</td><td>' + esc(r.sif) + '</td><td class="mono">' + esc(r.lote) + '</td><td class="n">' + (r.p ? fmtN(r.p.vol) : '—') + '</td><td class="n">' + (r.a ? fmtN(r.a.vol) : '—') + '</td><td class="n">' + (r.p ? fmtN(r.p.pl, 3) : '—') + '</td><td class="n">' + (r.a ? fmtN(r.a.pl, 3) : '—') + '</td><td>' + esc(r.msg) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' + (A.prods.length ? '<p class="sub" style="margin-top:8px">Certificados declarados no Anexo IV: ' + A.prods.map(function (p) { return 'produto ' + p.n + ' (SIF ' + esc(p.sif) + '): ' + p.certs.map(function (c) { return '<span class="doc ' + cor(c.num) + '"><span class="tag">' + esc(c.col) + '</span> ' + esc(c.num) + '</span>'; }).join(' '); }).join(' · ') + '</p>' : '') + '</details>';

    if (resp.length) h += '<details class="blk grp"><summary><h3>Documentos de respaldo (' + resp.length + ')</h3></summary><div class="inner">';
    resp.forEach(function (f) {
      var D = f.parsed;
      h += '<details class="blk"><summary><h3><span class="doc ' + cor(f.numero) + '"><span class="tag">' + esc(TYPES[f.type]) + '</span> ' + esc(f.numero || '(nº não lido)') + '</span>' + (f.pages.some(function (p) { return p.ocr; }) ? ' <span class="tag warn">OCR</span>' : '') + '</h3></summary>' +
        '<p class="sub">' + esc(f.name) + (D.destSif ? ' · destinatário SIF ' + esc(D.destSif) : '') + (D.destField ? ' · país de destino: ' + esc(D.destField) : '') + (D.habilDoc.length ? ' · países: ' + esc(D.habilDoc.join(', ')) : '') + '</p>' +
        '<div class="tw"><table><thead><tr><th>Item</th><th>Produto</th><th>Rótulo</th><th>Lotes lidos</th><th class="n">Vol.</th><th class="n">Peso líq.</th><th>Habilitação</th></tr></thead><tbody>' +
        (D.rows.length ? D.rows.map(function (r) { var hb = habilOf(f, r); return '<tr><td>' + esc(r.label) + '</td><td>' + esc(r.name) + '</td><td class="mono">' + esc(r.rotulo || '—') + '</td><td class="lotes">' + cinco(Array.from(r.lots)) + '</td><td class="n">' + fmtN(r.vol) + '</td><td class="n">' + fmtN(r.peso, 2) + '</td><td>' + esc(hb.list.join(', ') || '—') + '</td></tr>'; }).join('') : '<tr><td colspan="7">Não encontrei a tabela de produtos. Lotes no documento: ' + esc(Array.from(D.allLots).join(' ') || 'nenhum') + '</td></tr>') +
        '</tbody></table></div><details style="margin-top:10px;box-shadow:none;padding:0"><summary class="sub">Ver texto lido</summary><pre class="raw">' + esc(D.text) + '</pre></details></details>';
    });
    if (resp.length) h += '</div></details>';
    h += '<div class="wm" aria-hidden="true"><div></div></div>';
    $('out').innerHTML = h; ligaFerramentas(); ligaFotos(EXP); var p2 = $('pasta2'); if (p2) p2.onclick = function () { $('pastaMsg2').classList.remove('hide'); buscaPasta(false); };
    $('out').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- documentos da exportação: HashData, DCPOA emitida, SIGSIF, NF e croqui ---------- */
  var dig = function (x) { return String(x || '').replace(/\D/g, ''); };
  var NORMS = {
    num: function (x) { return dig(x); }, txt: function (x) { return norm(x).replace(/[^A-Z0-9]/g, ''); },
    t: function (x) { var n = parseFloat(String(x || '').replace(',', '.')); return isNaN(n) ? '' : n.toFixed(2); },
    q: function (x) { return x == null || x === '' ? '' : (+x).toFixed(3); }, d: function (x) { return x ? ano4(x) : ''; }
  };
  function confereExportacao(P, A, X, E, W) {
    var H = X.H, N = X.N, S = X.S, cols = [{ k: 'p', t: 'PSCF' }];
    if (A) cols.push({ k: 'a', t: 'Anexo IV' }); if (H) cols.push({ k: 'h', t: 'HashData' }); if (N) cols.push({ k: 'n', t: 'DCPOA emitida' }); if (S) cols.push({ k: 's', t: 'SIGSIF' });
    if (!H && !N && !S) return { cols: cols, rows: [] };
    var sumA = function (f) { if (!A) return null; var t = 0, any = false; A.prods.forEach(function (p) { p.lots.forEach(function (l) { if (l[f] != null) { t += l[f]; any = true; } }); }); return any ? t : null; };
    var sumP = function (f) { var t = 0; P.lines.forEach(function (l) { t += l[f] || 0; }); return P.lines.length ? t : null; };
    var codN = N ? Array.from(new Set(N.prods.map(function (p) { return p.codigo; }).filter(Boolean))).join(', ') : '';
    var destN = N ? Array.from(new Set(Object.keys(N.destinos).map(function (k) { return N.destinos[k]; }))).join(' / ') : '';
    var t1 = N && N.temps['1'] ? N.temps['1'] : {};
    var R = [
      { c: 'O.C. do PSCF', n: 'num', v: { p: P.oc, h: H && H.oc } },
      { c: 'Relatório de embarque', n: 'num', v: { p: dig(P.ref), a: A && A.embarque, h: H && H.ordem, n: codN } },
      { c: 'Destino', n: 'dest', v: { p: P.destino, a: A && A.destino, h: H && H.destino, n: destN } },
      { c: 'Container', n: 'txt', v: { p: P.container, h: H && H.container, n: N && N.contentor, s: S && S.container } },
      { c: 'Lacre SIF', n: 'txt', v: { p: P.lacre, h: H && H.lacre, n: N && N.lacre, s: S && S.lacre } },
      { c: 'Data do carregamento', n: 'd', v: { p: P.dtCarreg, h: H && H.ini.d, n: N && N.iniData, s: S && S.data } },
      { c: 'Verificação do veículo', n: 'txt', v: { h: H && (H.verif.d + ' ' + H.verif.h).trim(), n: N && ((N.verifData || '') + ' ' + (N.verifHora || '')).trim() } },
      { c: 'Início do carregamento', n: 'txt', nc: ['p'], v: { p: P.hrIni, h: H && H.ini.h, n: N && N.iniHora } },
      { c: 'Fim do carregamento', n: 'txt', nc: ['p'], v: { p: P.hrFim, h: H && H.fim.h, n: N && N.fimHora } },
      { c: 'Temperatura início', n: 't', v: { p: P.tIni, h: H && H.tIni, n: t1.ini } },
      { c: 'Temperatura meio', n: 't', v: { p: P.tMeio, h: H && H.tMeio, n: t1.meio } },
      { c: 'Temperatura fim', n: 't', v: { p: P.tFim, h: H && H.tFim, n: t1.fim } },
      { c: 'Termógrafo', n: 'txt', v: { p: P.termografo, h: H && H.termografo } },
      { c: 'Volumes', n: 'num', f: 0, v: { p: P.totVol != null ? P.totVol : sumP('vol'), a: sumA('vol'), n: N && N.totVol, s: S && S.totVol } },
      { c: 'Peso líquido (kg)', n: 'q', f: 3, v: { p: P.totPL != null ? P.totPL : sumP('pl'), a: sumA('pl'), n: N && N.totPeso, s: S && S.totPL } },
      { c: 'Nº da DCPOA emitida', n: 'txt', v: { n: N && N.numero, s: S && S.dcpoa } },
      { c: 'Referência SIGSIF', n: 'num', v: { a: A && A.sigsif, s: S && S.ref } }
    ];
    var tem = {}; cols.forEach(function (c) { tem[c.k] = 1; });
    R.forEach(function (r) {
      Object.keys(r.v).forEach(function (k) { if (!tem[k]) delete r.v[k]; });
      var ks = Object.keys(r.v).filter(function (k) { return r.v[k] != null && r.v[k] !== '' && !(r.nc && r.nc.indexOf(k) >= 0); });
      r.st = ''; if (ks.length < 2) return;
      if (r.n === 'dest') { var base = cl(r.v.p || r.v.a || ''), ruins = ks.filter(function (k) { return cl(r.v[k]).indexOf(base) < 0 && base.indexOf(cl(r.v[k])) < 0; }); r.st = ruins.length ? 'err' : 'ok'; r.bad = ruins; }
      else { var nv = {}; ks.forEach(function (k) { nv[k] = NORMS[r.n](r.v[k]); }); var vs = Array.from(new Set(ks.map(function (k) { return nv[k]; }))); r.st = vs.length > 1 ? 'err' : 'ok';
        if (vs.length > 1) { var cnt = {}; ks.forEach(function (k) { cnt[nv[k]] = (cnt[nv[k]] || 0) + 1; }); var maj = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0]; r.bad = cnt[maj] > 1 ? ks.filter(function (k) { return nv[k] !== maj; }) : ks; } }
      if (r.st === 'err') E(r.c + ' diferente entre os documentos da exportação.', ks.map(function (k) { return cols.find(function (c) { return c.k === k; }).t + ': ' + fmtV(r, r.v[k]); }).join(' · '));
    });
    // DCPOA emitida
    if (N) {
      if (N.finalidade && !/SOLICITACAO/.test(N.finalidade)) W('DCPOA emitida: a finalidade é "' + N.finalidade + '".', 'Para a exportação o esperado é Solicitação de Certificado Sanitário.');
      if (A && A.sif && N.sifExp && N.sifExp !== A.sif) E('DCPOA emitida pelo SIF ' + N.sifExp + ', mas a carga sai do SIF ' + A.sif + '.', '');
      var porRot = {}; P.lines.forEach(function (l) { (porRot[l.rotulo] = porRot[l.rotulo] || []).push(l); });
      N.prods.forEach(function (pr) {
        var ls = porRot[pr.rotulo], tag = 'DCPOA emitida, produto ' + pr.n + ' (' + (pr.rotulo || 'sem rótulo') + ')';
        if (!ls) { E(tag + ': rótulo não está no PSCF.', 'Rótulos do PSCF: ' + Object.keys(porRot).join(', ')); return; }
        var marcas = Array.from(new Set(ls.map(function (l) { return norm(l.marca); }).filter(Boolean)));
        if (pr.marca && marcas.length && marcas.indexOf(norm(pr.marca)) < 0) E(tag + ': marca ' + pr.marca + ' × ' + marcas.join(', ') + ' no PSCF.', '');
        var v = 0, pl = 0; ls.forEach(function (l) { v += l.vol || 0; pl += l.pl || 0; });
        if (pr.vol != null && pr.vol !== v) E(tag + ': ' + fmtN(pr.vol) + ' volumes × ' + fmtN(v) + ' no PSCF.', '');
        if (pr.peso != null && Math.abs(pr.peso - pl) > 0.01) E(tag + ': ' + fmtN(pr.peso, 3) + ' kg × ' + fmtN(pl, 3) + ' kg no PSCF.', '');
        var dp = ls.map(function (l) { return l.dtProd; }).filter(Boolean).sort(), dv = ls.map(function (l) { return l.dtVal; }).filter(Boolean).sort();
        if (dp.length && pr.prodIni && (dmy(pr.prodIni) !== dp[0] || dmy(pr.prodFim) !== dp[dp.length - 1])) E(tag + ': produção ' + pr.prodIni + ' a ' + pr.prodFim + ' × ' + showD(dp[0]) + ' a ' + showD(dp[dp.length - 1]) + ' no PSCF.', '');
        if (dv.length && pr.valIni && (dmy(pr.valIni) !== dv[0] || dmy(pr.valFim) !== dv[dv.length - 1])) E(tag + ': validade ' + pr.valIni + ' a ' + pr.valFim + ' × ' + showD(dv[0]) + ' a ' + showD(dv[dv.length - 1]) + ' no PSCF.', '');
        var emb = (A && A.embarque) || dig(P.ref); if (pr.codigo && emb && pr.codigo !== emb) E(tag + ': código de rastreabilidade ' + pr.codigo + ', mas o relatório de embarque é ' + emb + '.', '');
        if (ls[0].prod && nameScore(ls[0].prod.desc, pr.nome) < 0.75) W(tag + ': nomenclatura diferente do PSCF.', 'DCPOA emitida: ' + pr.nome + ' · PSCF: ' + ls[0].prod.desc);
        var lp = Array.from(new Set(ls.map(function (l) { return l.lote; })));
        if (!pr.lotes.length) { if (!N.lotesNoAnexo) E(tag + ': lote não informado e as observações não remetem ao Anexo IV.', 'Lotes do PSCF: ' + lp.join(', ')); }
        else { var falta = lp.filter(function (x) { return pr.lotes.indexOf(x) < 0; }), sobra = pr.lotes.filter(function (x) { return lp.indexOf(x) < 0; });
          if (falta.length) E(tag + ': faltam lotes do PSCF.', falta.join(', ')); if (sobra.length) E(tag + ': lote que não está no PSCF.', sobra.join(', ')); }
        var dpr = N.destinos[pr.n]; if (dpr && P.destino && cl(dpr).indexOf(cl(P.destino)) < 0) E(tag + ': destino ' + dpr + ', mas a carga vai para ' + P.destino + '.', '');
        var tp = N.temps[pr.n]; if (tp && t1.ini && (tp.ini !== t1.ini || tp.meio !== t1.meio || tp.fim !== t1.fim)) W(tag + ': temperaturas diferentes do produto 1.', '');
      });
      Object.keys(porRot).forEach(function (r) { if (!N.prods.some(function (p) { return p.rotulo === r; })) E('DCPOA emitida não traz o rótulo ' + r + ', que está no PSCF.', ''); });
      if (A && A.numero) { var an = dig(A.numero.replace(/\(.*\)/, '')); if (!N.anexo4) W('DCPOA emitida não cita o Anexo IV nos documentos de respaldo.', 'Anexo IV: ' + A.numero); else if (dig(N.anexo4) !== an) E('DCPOA emitida cita o Anexo IV nº ' + N.anexo4 + ', mas o Anexo IV carregado é o ' + A.numero + '.', ''); }
      if (X.nf.length) X.nf.forEach(function (nf) { if (nf.numero && N.nfs.map(function (x) { return String(+x); }).indexOf(nf.numero) < 0) E('DCPOA emitida não cita a nota fiscal ' + nf.numero + '.', 'Notas citadas: ' + (N.nfs.join(', ') || 'nenhuma')); });
      else if (!N.nfs.length) W('DCPOA emitida não cita nota fiscal nos documentos de respaldo.', '');
      Object.keys(porRot).forEach(function (r) { if (r && N.croquis.indexOf(r) < 0) W('DCPOA emitida não cita o croqui do rótulo ' + r + '.', 'Croquis citados: ' + (N.croquis.join(', ') || 'nenhum')); });
      X.croqui.forEach(function (c) { if (c.rotulo && !N.croquis.some(function (x) { return x.indexOf(c.rotulo + '/') === 0; })) W('Croqui do rótulo ' + c.rotulo + ' carregado, mas a DCPOA emitida não cita.', ''); });
      var tdc = Array.from(new Set(P.lines.filter(function (l) { return l.cert && tipoNum(l.cert) === 'dcpoa'; }).map(function (l) { return l.cert; })));
      tdc.forEach(function (c) { if (!N.transito.some(function (t) { return certKey(t) === certKey(c); })) W('DCPOA emitida não cita a DCPOA de trânsito ' + c + ' nas observações.', 'Ela é respaldo de lotes do PSCF.'); });
      N.transito.forEach(function (t) { if (!tdc.some(function (c) { return certKey(c) === certKey(t); })) E('DCPOA emitida cita a DCPOA de trânsito ' + t + ', que o PSCF não usa.', ''); });
    }
    // SIGSIF da exportação
    if (S) {
      if (S.parecer && !/APROVADO/.test(S.parecer)) W('SIGSIF ' + (S.ref || '') + ': parecer ' + S.parecer + '.', '');
      if (A && A.sif && S.sif && S.sif !== A.sif) W('SIGSIF emitido para o SIF ' + S.sif + ', mas a carga sai do SIF ' + A.sif + '.', '');
      var ls2 = Array.from(new Set(P.lines.map(function (l) { return l.lote; }))), lsS = []; S.prods.forEach(function (p) { p.lotes.forEach(function (x) { if (lsS.indexOf(x) < 0) lsS.push(x); }); });
      var f2 = ls2.filter(function (x) { return lsS.indexOf(x) < 0; }), s2 = lsS.filter(function (x) { return ls2.indexOf(x) < 0; });
      if (f2.length) E('SIGSIF: faltam lotes do PSCF.', f2.join(', ')); if (s2.length) E('SIGSIF: lote que não está no PSCF.', s2.join(', '));
      var sifsP = Array.from(new Set(P.lines.map(function (l) { return l.sif; })));
      S.prods.forEach(function (p) { [['abate', p.abate], ['processador', p.proc]].forEach(function (x) { if (x[1] && !/^X+$/.test(x[1]) && sifsP.indexOf(x[1]) < 0) W('SIGSIF, produto ' + p.n + ': SIF de ' + x[0] + ' ' + x[1] + ' não está no PSCF.', 'SIF do PSCF: ' + sifsP.join(', ')); });
        if (A && A.sif && p.arm && p.arm !== A.sif) E('SIGSIF, produto ' + p.n + ': armazenador ' + p.arm + ', mas a carga sai do SIF ' + A.sif + '.', ''); });
    }
    return { cols: cols, rows: R.filter(function (r) { return Object.keys(r.v).some(function (k) { return r.v[k] != null && r.v[k] !== ''; }); }) };
  }
  function fmtV(r, v) { if (v == null || v === '') return '—'; if (r.f != null && typeof v === 'number') return fmtN(v, r.f); return String(v); }
  function blocoExportacao(G, X) {
    var h = '<details class="blk" open><summary><h3>Documentos da exportação</h3></summary><div class="tw"><table class="grade"><thead><tr><th></th><th>Campo</th>' + G.cols.map(function (c) { return '<th>' + esc(c.t) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      G.rows.map(function (r) { return '<tr class="' + (r.st === 'err' ? 'bad' : '') + '"><td>' + (r.st ? '<span class="ico ' + r.st + '">' + (r.st === 'ok' ? '✓' : '✕') + '</span>' : '') + '</td><td>' + esc(r.c) + '</td>' +
        G.cols.map(function (c) { var v = r.v[c.k], nc = r.nc && r.nc.indexOf(c.k) >= 0, bad = r.bad && r.bad.indexOf(c.k) >= 0; return '<td class="' + (nc ? 'nc' : '') + (bad ? ' x' : '') + '"' + (nc ? ' title="Horário do sistema: não entra na comparação"' : '') + '>' + esc(fmtV(r, v)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    if (X.H) h += '<div id="fotosBox" class="fotosbox"></div>';
    return h + '</details>';
  }
  /* ---------- fotos do HashData: PaddleOCR (PP-OCRv3) offline, o mesmo leitor da Conferência da Carga ---------- */
  var FOTO_RE0 = /(foto|evid[êe]ncia|registro).*(lacre|cont[êe]iner|contentor|container)|(lacre|cont[êe]iner).*(foto)|evid[êe]ncias? do fechamento das? portas?|ve[íi]culo lacrado|portas fechadas|foto da ordem de carga|foto do term[óo]grafo/i;
  var FOTO_NAO = /lava[çc][ãa]o/i; // lacre de lavação não é o lacre SIF
  var FOTO_MULTI = /fechamento das? portas?|ve[íi]culo lacrado|portas fechadas|ordem de carga/i;
  var FOTO_VEIC = /(foto|registro).*(placa|condi[çc][õo]es estruturais)/i;
  var FT = { estado: 'off', erro: '', cache: {}, chave: null, grupos: null, H: null, N: null, lendo: false, carregando: false };
  var rot = function (q) { return (q.semNum ? '' : q.n + '. ') + q.label; };
  var ehFoto = function (re, l) { return re.test(l) && !FOTO_NAO.test(l); };
  async function fotosHash(f, H) {
    var FOTO_RE = (!H.container && H.placa) ? new RegExp(FOTO_RE0.source + '|' + FOTO_VEIC.source, 'i') : FOTO_RE0;
    var qa = H.lista.filter(function (q) { return ehFoto(FOTO_RE, q.label) && q.page; }); if (!qa.length) return [];
    var pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await f.file.arrayBuffer()), isEvalSupported: false }).promise, porPag = {}, vistas = {};
    var mul = function (m, t) { return [m[0] * t[0] + m[2] * t[1], m[1] * t[0] + m[3] * t[1], m[0] * t[2] + m[2] * t[3], m[1] * t[2] + m[3] * t[3], m[0] * t[4] + m[2] * t[5] + m[4], m[1] * t[4] + m[3] * t[5] + m[5]]; };
    async function imgsDaPagina(n) {
      if (porPag[n]) return porPag[n]; if (n < 1 || n > pdf.numPages) return [];
      for (var ant = 1; ant < n; ant++) if (!porPag[ant]) await imgsDaPagina(ant);
      var page = await pdf.getPage(n), ops = await page.getOperatorList(), out = [], ctm = [1, 0, 0, 1, 0, 0], pilha = [];
      for (var i = 0; i < ops.fnArray.length; i++) {
        var fn = ops.fnArray[i];
        if (fn === pdfjsLib.OPS.save) { pilha.push(ctm); continue; } if (fn === pdfjsLib.OPS.restore) { ctm = pilha.pop() || [1, 0, 0, 1, 0, 0]; continue; }
        if (fn === pdfjsLib.OPS.transform) { ctm = mul(ctm, ops.argsArray[i]); continue; }
        if (fn !== pdfjsLib.OPS.paintImageXObject && fn !== pdfjsLib.OPS.paintJpegXObject) continue;
        var yTop = Math.max(ctm[5], ctm[5] + ctm[3], ctm[5] + ctm[1]), id = ops.argsArray[i][0], store = String(id).indexOf('g_') === 0 ? page.commonObjs : page.objs;
        var img = await Promise.race([new Promise(function (res) { try { if (store.has(id)) res(store.get(id)); else store.get(id, res); } catch (e) { res(null); } }), new Promise(function (res) { setTimeout(function () { res(null); }, 4000); })]);
        if (!img || Math.max(img.width, img.height) < 300 || img.width * img.height < 60000) continue; // logos do cabeçalho
        var full = document.createElement('canvas'); full.width = img.width; full.height = img.height; var fx = full.getContext('2d');
        if (img.bitmap) fx.drawImage(img.bitmap, 0, 0);
        else if (img.data) { var id2 = fx.createImageData(img.width, img.height), src = img.data;
          if (src.length === img.width * img.height * 4) id2.data.set(src); else for (var pp = 0, qq = 0; pp < src.length; pp += 3, qq += 4) { id2.data[qq] = src[pp]; id2.data[qq + 1] = src[pp + 1]; id2.data[qq + 2] = src[pp + 2]; id2.data[qq + 3] = 255; }
          fx.putImageData(id2, 0, 0); }
        else continue;
        var px = fx.getImageData(0, 0, img.width, img.height);
        // foto alta cortada entre duas páginas: o PDF desenha a mesma imagem de novo na página seguinte (conta uma vez só)
        var sig = img.width + 'x' + img.height + ':'; for (var si = 0; si < 48; si++) { var off = (Math.floor(px.data.length / 4 / 49 * (si + 1)) * 4); sig += px.data[off] + ',' + px.data[off + 1] + ',' + px.data[off + 2] + ';'; }
        if (vistas[sig] != null && n - vistas[sig] <= 1) continue; vistas[sig] = n;
        var sc = Math.min(1, 900 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc); cv.getContext('2d').drawImage(full, 0, 0, cv.width, cv.height);
        out.push({ page: n, yTop: yTop, id: f.id + ':' + n + ':' + id, url: cv.toDataURL('image/jpeg', 0.85), px: { data: px.data, width: px.width, height: px.height } });
      }
      porPag[n] = out; return out;
    }
    // as fotos vêm no PDF na mesma ordem das perguntas com resposta "N imagem(ns)"
    var comFoto = H.lista.map(function (q) { return { q: q, n: +((/^(\d+)\s+image(?:m|ns)$/i.exec(String(q.value).trim()) || [])[1] || 0) }; }).filter(function (x) { return x.n > 0; });
    var ultimo = comFoto.reduce(function (a, x, i) { return ehFoto(FOTO_RE, x.q.label) ? i : a; }, -1);
    var precisa = comFoto.slice(0, ultimo + 1).reduce(function (a, x) { return a + x.n; }, 0), grupos = [];
    // 1º jeito: pela posição na página (cada foto fica logo abaixo da sua pergunta, às vezes já na página seguinte)
    try {
      var posY = {};
      for (var pn of Array.from(new Set(comFoto.map(function (x) { return x.q.page; })))) { var tc = await (await pdf.getPage(pn)).getTextContent(); tc.items.forEach(function (it) { var m = /^(\d+)\.(\s|$)/.exec(it.str.trim()); if (m) posY[pn + ':' + m[1]] = it.transform[5]; }); }
      var cand = comFoto.map(function (x) { return { x: x, y: posY[x.q.page + ':' + x.q.n] }; }).filter(function (c) { return c.y != null; });
      if (cand.length === comFoto.length && precisa > 0) {
        var ultPag = Math.min(pdf.numPages, Math.max.apply(null, cand.map(function (c) { return c.x.q.page; })) + 2), imgs = [];
        for (var pq = 1; pq <= ultPag; pq++) imgs = imgs.concat(await imgsDaPagina(pq));
        var dono = new Map(cand.map(function (c) { return [c, []]; }));
        imgs.forEach(function (im) { var own = null; cand.forEach(function (c) { if (c.x.q.page < im.page || (c.x.q.page === im.page && c.y > im.yTop - 4)) own = c; }); if (own && dono.get(own).length < own.x.n) dono.get(own).push(im); });
        var ok = cand.filter(function (c) { return ehFoto(FOTO_RE, c.x.q.label); });
        if (ok.length && ok.every(function (c) { return dono.get(c).length === c.x.n; })) { ok.forEach(function (c) { grupos.push({ label: rot(c.x.q), imgs: dono.get(c) }); }); return grupos; }
      }
    } catch (e) { console.warn('posição das fotos', e); }
    // 2º jeito: pela ordem das perguntas com "N imagem(ns)"
    var todas = [], pg = 1; while (todas.length < precisa && pg <= pdf.numPages) { todas = todas.concat(await imgsDaPagina(pg)); pg++; }
    if (todas.length >= precisa && precisa > 0) { var k = 0; comFoto.slice(0, ultimo + 1).forEach(function (x) { var ims = todas.slice(k, k + x.n); k += x.n; if (ehFoto(FOTO_RE, x.q.label)) grupos.push({ label: rot(x.q), imgs: ims }); }); }
    else for (var q of qa) grupos.push({ label: rot(q), imgs: (await imgsDaPagina(q.page)).concat(await imgsDaPagina(q.page + 1)) });
    return grupos;
  }
  function valoresFoto() { var H = FT.H, N = FT.N, v = []; if (!H) return v;
    if (H.lacre) v.push(['Lacre SIF', H.lacre]); if (H.lacreSeara) v.push(['Lacre Seara', H.lacreSeara]); if (H.lacreIntertek) v.push(['Lacre armador', H.lacreIntertek]);
    if (H.container) v.push(['Contêiner', H.container]); else if (H.placa) v.push(['Placa da carreta', H.placa + ' · sem contêiner']);
    if (H.termografo) v.push(['Termógrafo', H.termografo]); if (H.oc) v.push(['O.C.', H.oc]); if (H.ordem) v.push(['Ordem de carga', H.ordem]);
    if (N && N.lacre) v.push(['Lacre na DCPOA emitida', N.lacre]); if (N && N.contentor && /\d/.test(N.contentor)) v.push(['Contêiner na DCPOA emitida', N.contentor]); return v; }
  function alvosDe(label) { var H = FT.H; if (/ordem de carga/i.test(label)) return [['O.C.', H.oc], ['ordem de carga', H.ordem]].filter(function (x) { return x[1]; });
    return [['lacre SIF', H.lacre], ['lacre Seara', H.lacreSeara], ['lacre armador', H.lacreIntertek], ['contêiner', H.container], ['placa', H.placa]].filter(function (x) { return x[1]; }); }
  function valorDe(label) { var H = FT.H; if (/term[óo]grafo/i.test(label)) return H.termografo; if (/SEARA/i.test(label)) return H.lacreSeara; if (/intertek|armador/i.test(label)) return H.lacreIntertek;
    if (/lacre/i.test(label)) return H.lacre; if (/cont[êe]iner|contentor|container/i.test(label)) return H.container; if (/placa|ve[íi]culo|estrutur/i.test(label)) return H.placa; return null; }
  var multi = function (l) { return FOTO_MULTI.test(l) && !/foto do lacre/i.test(l); };
  function packBytes() { var b = atob($('ocrpack').textContent.trim()), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  async function ocrLiga() {
    if (FT.estado !== 'off') return; FT.estado = 'carregando'; desenhaFotos();
    try {
      await new Promise(function (r) { setTimeout(r, 30); });
      var u8 = packBytes(); if (new TextDecoder().decode(u8.subarray(0, 8)) !== 'CCSOCR01') throw new Error('pacote do leitor inválido');
      var hl = new DataView(u8.buffer, 8, 4).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(u8.subarray(12, 12 + hl))), base = 12 + hl, P = {};
      head.files.forEach(function (e) { P[e.name] = u8.subarray(base + e.offset, base + e.offset + e.length); });
      var wasmURL = URL.createObjectURL(new Blob([P['ort-wasm-simd.wasm']], { type: 'application/wasm' }));
      ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false; ort.env.wasm.wasmPaths = { 'ort-wasm-simd.wasm': wasmURL, 'ort-wasm.wasm': wasmURL };
      await FotoOCR.init(ort, { det: P['det.onnx'], cls: P['cls.onnx'], rec: P['rec.onnx'], keys: new TextDecoder().decode(P['keys.txt']) });
      FT.estado = 'pronto';
    } catch (e) { console.error(e); FT.estado = 'erro'; FT.erro = e && e.message || String(e); }
    desenhaFotos(); lerFotos();
  }
  var RANK = { ok: 5, numero: 4, iso: 3, quase: 2, diferente: 1, nada: 0 };
  // recorte da foto em volta do código lido (contêiner ou placa), para mostrar onde a ferramenta leu
  function recorteIdentificacao(px, itens, tipo) {
    var padrao = tipo === 'placa' ? /^(?!SIF)[A-Z]{3}\d[A-Z0-9]\d{2}$/ : /^[A-Z]{3}[UJZ]\d{7}$/;
    for (var i = 0; i < itens.length; i++) {
      var codigo = '', caixas = [];
      for (var j = i; j < Math.min(i + 4, itens.length); j++) {
        var b = itens[j]; if (b.ux == null) break;
        codigo += norm(b.text).replace(/[\s.-]/g, ''); if (codigo.length > 11) break;
        if (caixas.length && (Math.abs(b.cy - itens[i].cy) > 2 * Math.max(b.h, itens[i].h) || Math.abs(b.cx - itens[j - 1].cx) > 2 * (b.w + itens[j - 1].w))) break;
        caixas.push(b); if (!padrao.test(codigo)) continue;
        var xs = [], ys = [];
        caixas.forEach(function (c) { var dx = (Math.abs(c.ux) * c.w + Math.abs(c.uy) * c.h) * c.sxr / 2, dy = (Math.abs(c.uy) * c.w + Math.abs(c.ux) * c.h) * c.syr / 2; xs.push(c.cx - dx, c.cx + dx); ys.push(c.cy - dy, c.cy + dy); });
        var mg = Math.max(8, Math.min(Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, ys) - Math.min.apply(null, ys)) * 0.7);
        var x = Math.max(0, Math.floor(Math.min.apply(null, xs) - mg)), y = Math.max(0, Math.floor(Math.min.apply(null, ys) - mg));
        var w = Math.min(px.width, Math.ceil(Math.max.apply(null, xs) + mg)) - x, h = Math.min(px.height, Math.ceil(Math.max.apply(null, ys) + mg)) - y;
        if (!(w > 0 && h > 0)) continue;
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h; var ctx = cv.getContext('2d'), pix = ctx.createImageData(w, h);
        for (var ln = 0; ln < h; ln++) { var ini = ((ln + y) * px.width + x) * 4; pix.data.set(px.data.subarray(ini, ini + w * 4), ln * w * 4); }
        ctx.putImageData(pix, 0, 0); return cv.toDataURL('image/jpeg', 0.92);
      }
    }
    return '';
  }
  async function leGrupo(g, alvo, multiplo) {
    var lidos = [], porImg = {}, pausa = function () { return new Promise(function (r) { setTimeout(r, 10); }); };
    var le = async function (im, k) { var key = im.id + (k ? ':r' + k : ''); if (!FT.cache[key]) { try { FT.cache[key] = await FotoOCR.read(k ? FotoOCR.rotate(im.px, k) : im.px); } catch (e) { FT.cache[key] = []; } } if (!k) porImg[im.id] = FT.cache[key]; return FT.cache[key]; };
    var bateu = function () { return multiplo ? alvo.every(function (a) { return FotoOCR.confere(lidos, a[1]).status === 'ok'; }) : FotoOCR.confere(lidos, alvo).status === 'ok'; };
    for (var im of g.imgs) { lidos = lidos.concat(await le(im, 0)); await pausa(); if (bateu()) break; }
    // se não bateu, tenta a foto girada (lacre fotografado de lado)
    for (var k of [1, 3]) { if (bateu()) break; for (var im2 of g.imgs) { lidos = lidos.concat(await le(im2, k)); await pausa(); } }
    // contêiner escrito na vertical (letra embaixo de letra, na porta ou na lateral)
    var cont = multiplo ? (alvo.find(function (a) { return a[0] === 'contêiner'; }) || [])[1] : (/cont[êe]iner|contentor|container/i.test(g.label) ? alvo : null);
    if (cont && FotoOCR.readStacked && FotoOCR.confere(lidos, cont).status !== 'ok') {
      for (var im3 of g.imgs) { var key = im3.id + ':vert'; if (!FT.cache[key]) { try { FT.cache[key] = await FotoOCR.readStacked(im3.px); } catch (e) { FT.cache[key] = []; } }
        lidos = lidos.concat(FT.cache[key]); porImg[im3.id] = (porImg[im3.id] || []).concat(FT.cache[key]); await pausa(); if (FotoOCR.confere(lidos, cont).status === 'ok') break; }
    }
    // recorte de onde o contêiner foi lido
    if (cont && FotoOCR.confere(lidos, cont).status === 'ok' && !g.recorte) for (var im4 of g.imgs) { if (porImg[im4.id] && (g.recorte = recorteIdentificacao(im4.px, porImg[im4.id], 'container'))) break; }
    return lidos;
  }
  async function lerFotos() {
    if (FT.estado !== 'pronto' || FT.lendo || !FT.grupos) return; FT.lendo = true;
    try {
      for (var g of FT.grupos) {
        if (g.ocr || !g.imgs.length) continue;
        if (multi(g.label)) { var alvos = alvosDe(g.label); if (!alvos.length) continue; g.ocr = { status: 'lendo' }; desenhaFotos();
          var l1 = await leGrupo(g, alvos, true); g.ocr = { status: 'multi', itens: alvos.map(function (a) { return { nome: a[0], v: a[1], c: FotoOCR.confere(l1, a[1]) }; }) }; desenhaFotos(); continue; }
        var valor = valorDe(g.label); if (!valor) continue;
        g.ocr = { status: 'lendo' }; desenhaFotos();
        var l2 = await leGrupo(g, valor, false), c = FotoOCR.confere(l2, valor);
        g.ocr = Object.assign(c, { textos: l2.map(function (x) { return x.text; }).filter(function (x) { return /\d{3,}|^[A-Z]{4}$/i.test(x.replace(/\s/g, '')); }) }); desenhaFotos();
      }
    } finally { FT.lendo = false; }
  }
  function seloOCR(g, valor) {
    var o = g.ocr; if (!o || (!valor && o.status !== 'multi' && o.status !== 'lendo')) return '';
    if (o.status === 'multi') return o.itens.map(function (it) { var c = it.c; return c.status === 'ok' || c.status === 'numero' ? '<span class="fo ok">✓ ' + esc(it.nome) + ' ' + esc(it.v) + '</span>' : c.status === 'quase' ? '<span class="fo warn">⚠ ' + esc(it.nome) + ': li ' + esc(c.lido) + '</span>' : c.status === 'iso' ? '<span class="fo bad">⚠ ' + esc(it.nome) + ': letras não fecham com o dígito</span>' : '<span class="fo na">' + esc(it.nome) + ' não aparece</span>'; }).join(' ');
    if (o.status === 'lendo') return '<span class="fo lendo">lendo a foto…</span>';
    if (o.status === 'ok') return '<span class="fo ok">✓ a foto confere</span>';
    if (o.status === 'numero') return '<span class="fo ok">✓ o número confere (não consegui ler as letras ' + esc(o.letras) + ')</span>';
    if (o.status === 'iso') return '<span class="fo bad">⚠ o número bate, mas as letras digitadas (' + esc(o.letras) + ') não fecham com o dígito verificador: confira as letras na foto</span>';
    if (o.status === 'quase') return '<span class="fo warn">⚠ parecido: li ' + esc(o.lido) + ', confira</span>';
    // termógrafo costuma aparecer de longe no palete: sem número parecido na foto, é aviso neutro
    if (o.status === 'diferente' && /term[óo]grafo/i.test(g.label) && !o.textos.some(function (t) { return t.replace(/\W/g, '').length >= 6; })) return '<span class="fo na">número não legível nesta foto, confira no olho</span>';
    if (o.status === 'diferente') return '<span class="fo bad">⚠ não achei o número digitado na foto' + (o.textos.length ? ' · li: ' + esc(o.textos.slice(0, 5).join(' · ')) : '') + '</span>';
    return '<span class="fo warn">não consegui ler a foto, confira no olho</span>';
  }
  function desenhaFotos() {
    var box = $('fotosBox'); if (!box || !FT.H) return;
    var vals = valoresFoto(), gs = (FT.grupos || []).filter(function (g) { return g.imgs.length; });
    var nota = { pronto: 'Leitura automática ligada: a ferramenta lê o número na foto e compara com o digitado. Mesmo assim, dê uma olhada nas fotos.', carregando: 'Ligando a leitura automática das fotos…', erro: 'Não consegui ligar a leitura automática: ' + esc(FT.erro) + '. Confira as fotos no olho.' }[FT.estado] || 'Confira no olho se o número da foto é o mesmo que foi digitado. Clique na foto para ampliar.';
    box.innerHTML = '<h3 class="ft">Fotos do HashData: lacre, contêiner, ordem de carga e termógrafo</h3><div class="fvals">' + vals.map(function (x) { return '<div><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('') + '</div>' +
      (FT.carregando ? '<div class="fnota">Separando as fotos do HashData…</div>' : (!gs.length ? '<div class="fnota">Não achei fotos de lacre, contêiner, ordem de carga ou termógrafo neste HashData.</div>' : '')) +
      gs.map(function (g) { var valor = multi(g.label) ? null : valorDe(g.label); return '<div class="fg"><div class="fl">' + esc(g.label) + (valor ? ' · digitado: <b class="fv">' + esc(valor) + '</b>' : '') + ' ' + seloOCR(g, valor) + (g.recorte ? ' <a href="#" class="frec" data-foto="' + g.recorte + '" title="Onde a ferramenta leu o número"><img src="' + g.recorte + '" alt="trecho lido"></a>' : '') + '</div><div class="fimgs">' + g.imgs.map(function (im) { return '<a href="#" data-foto="' + im.url + '"><img src="' + im.url + '" alt=""></a>'; }).join('') + '</div></div>'; }).join('') +
      (gs.length ? '<div class="fnota">' + nota + '</div>' : '');
    box.querySelectorAll('[data-foto]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); var ov = document.createElement('div'); ov.className = 'fover'; ov.innerHTML = '<img src="' + a.getAttribute('data-foto') + '">'; ov.onclick = function () { ov.remove(); }; document.body.appendChild(ov); }; });
  }
  async function ligaFotos(X) {
    if (!X.H || !X.fH) return;
    FT.H = X.H; FT.N = X.N;
    if (FT.chave !== X.fH.id) { FT.chave = X.fH.id; FT.grupos = null; FT.carregando = true; desenhaFotos();
      try { FT.grupos = await fotosHash(X.fH, X.H); } catch (e) { console.warn(e); FT.grupos = []; }
      FT.carregando = false; }
    desenhaFotos(); if (FT.grupos && FT.grupos.length) { if (FT.estado === 'off') ocrLiga(); else lerFotos(); }
  }
  /* ---------- impressão, página e compilado ---------- */
  var CARGA = {};
  function cinco(a) { var o = []; for (var i = 0; i < a.length; i += 5) o.push(esc(a.slice(i, i + 5).join(' '))); return o.join('<br>'); }
  function baixar(blob, nome) { var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); }
  function hoje(comHora) { var d = new Date(), z = function (n) { return String(n).padStart(2, '0'); }; return z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear() + (comHora ? ' ' + z(d.getHours()) + ':' + z(d.getMinutes()) : ''); }
  function seguro(s) { return String(s || '').replace(/[\\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim(); }
  function nomeOk() {
    var i = $('nome'), v = i ? i.value.trim() : ''; if (i) i.classList.toggle('falta', !v); var av = $('nomeAviso'); if (av) av.classList.toggle('hide', !!v);
    if (!v) { if (i) i.focus(); return ''; }
    try { localStorage.setItem('hub-nome', v); } catch (e) {} marca(v); return v;
  }
  function marca(nome) {
    var t = 'USO INTERNO SEARA · ' + hoje() + ' · ' + nome, w = document.querySelector('#out .wm > div');
    if (w) { var sp = ''; for (var i = 0; i < 60; i++) sp += '<span>' + esc(t) + '</span>'; w.innerHTML = sp; }
    var ph = document.querySelector('#out .phead'); if (ph) ph.innerHTML = 'Conferido por <b>' + esc(nome) + '</b> em ' + esc(hoje(true)) + ' · USO INTERNO SEARA';
  }
  function nomeBase() { var c = CARGA, p = ['Conferencia respaldo HUB']; if (c.oc) p.push('OC ' + c.oc); else if (c.ref) p.push(c.ref); if (c.container) p.push(c.container); p.push(hoje().replace(/\//g, '-')); return seguro(p.join(' - ')); }
  function paginaHtml() {
    var css = Array.prototype.map.call(document.querySelectorAll('style'), function (x) { return x.textContent; }).join('\n');
    var out = $('out').cloneNode(true); out.removeAttribute('id');
    Array.prototype.forEach.call(out.querySelectorAll('.tools'), function (x) { x.remove(); });
    var head = document.querySelector('header').cloneNode(true); Array.prototype.forEach.call(head.querySelectorAll('button'), function (x) { x.remove(); });
    return '<!DOCTYPE html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; font-src data:; img-src data:">' +
      '<title>' + esc(nomeBase()) + '</title><style>' + css + '</style></head><body class="snap"><main>' + head.outerHTML + out.innerHTML +
      '<footer>' + esc($('versao').textContent) + ' · Desenvolvido por Sandi · Tudo conferido no próprio computador, sem envio de dados</footer></main></body></html>';
  }
  function ligaFerramentas() {
    var abre = function (v) { Array.prototype.forEach.call(document.querySelectorAll('#out details.blk'), function (d) { d.open = v; }); };
    $('expAll').onclick = function () { abre(true); }; $('colAll').onclick = function () { abre(false); };
    $('nome').oninput = function () { if (this.value.trim()) { this.classList.remove('falta'); $('nomeAviso').classList.add('hide'); } };
    $('prt').onclick = function () { if (nomeOk()) window.print(); };
    $('dlPage').onclick = function () { if (nomeOk()) baixar(new Blob([paginaHtml()], { type: 'text/html' }), nomeBase() + '.html'); };
    $('dlZip').onclick = async function () {
      if (!nomeOk()) return; var b = this, t = b.textContent; b.disabled = true; b.textContent = 'Montando…';
      try {
        var z = new JSZip(), base = nomeBase(), usados = {};
        z.file(base + '.html', paginaHtml());
        var PASTA = { pscf: 'PSCF', anexo4: 'Anexo IV', hashdata: 'HashData', dcpoanova: 'DCPOA emitida', sigsifexp: 'SIGSIF da exportacao', nf: 'Nota fiscal', croqui: 'Croqui', ficha: 'Ficha do SIF' }, pasta = function (f) { return PASTA[f.type] || (isResp(f.type) ? 'Respaldos' : 'Outros'); };
        files.forEach(function (f) { if (!f.file) return; var n = pasta(f) + '/' + f.name, k = 1; while (usados[n]) n = pasta(f) + '/' + f.name.replace(/(\.[^.]+)?$/, ' (' + (++k) + ')$1'); usados[n] = 1; z.file(n, f.file); });
        baixar(await z.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }), base + '.zip');
      } catch (e) { alertaPasta('err', 'Não consegui montar o compilado: ' + (e && e.message || e)); }
      b.disabled = false; b.textContent = t;
    };
  }
  window.addEventListener('beforeprint', function () { var i = $('nome'); if (i && i.value.trim()) marca(i.value.trim()); });

  /* ---------- buscar os respaldos numa pasta ---------- */
  function alertaPasta(k, t, d, busy, extra) {
    ['pastaMsg', 'pastaMsg2'].forEach(function (id) { var m = $(id); if (!m) return; m.className = 'pmsg ' + (k || '') + (busy ? ' busy' : '');
      m.innerHTML = esc(t) + (d ? '<small>' + esc(d) + '</small>' : '') + (busy ? '<div class="pbar"><i></i></div>' : '') + (extra || ''); });
    var m2 = $('pastaMsg2'); if (m2 && !m2.classList.contains('hide')) m2.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  // certificados que a carga usa: PSCF + Anexo IV
  function necessarios() {
    var req = {}, pf = files.find(function (f) { return f.type === 'pscf' && f.status === 'ok'; }), af = files.find(function (f) { return f.type === 'anexo4' && f.status === 'ok'; });
    if (pf) parsePSCF(pf.pages, pf.ext === 'pdf').lines.forEach(function (l) { if (l.key && l.cert) req[l.key] = l.cert; });
    if (af) parseAnexo(af.pages).prods.forEach(function (p) { p.certs.forEach(function (c) { req[c.key] = req[c.key] || c.num; }); });
    return { req: req, tem: !!(pf || af) };
  }
  // nome do arquivo × número do certificado. No Windows a "/" vira "-" ("N0-00598842-3837-26", "003364-3837-26")
  // ou fica só o primeiro número ("003364"). forte = número + SIF; fraco = só o primeiro número (confere o conteúdo antes)
  function partesNum(num) { var u = norm(num).replace(/^[A-Z0-9]{2}-(?=\d{8})/, ''), p = u.split(/\s*\/\s*/).map(function (x) { return x.replace(/\D/g, ''); }); return { main: p[0] || '', sif: p[1] || '', ano: p[2] || '' }; }
  function casaNome(nome, keys, req) {
    var base = String(nome).replace(/\.(pdf|xlsx|xlsm|jpe?g|png|webp|bmp)$/i, '').replace(/\(\d+\)/g, ' '), out = [];
    // números depois de "SUB" são da DCPOA substituída
    var tk = [], subDesde = Infinity, re = /\d+|\bSUB\b/gi, m;
    while ((m = re.exec(base))) { if (/^sub$/i.test(m[0])) { if (subDesde === Infinity) subDesde = tk.length; } else tk.push(m[0]); }
    keys.forEach(function (k) {
      var P = partesNum(req[k] || k); if (!P.main) return;
      var melhor = null;
      tk.forEach(function (t, i) {
        if (t !== P.main) return;
        var r = null;
        if (P.main.length === 8) r = 'forte'; // número do CSN/CSI é único
        else {
          var j = i + 1; while (tk[j] && tk[j].length === P.main.length && j < subDesde) j++; // 002373_002372_1215_26
          var nx = tk[j];
          if (!nx || j >= subDesde && i < subDesde) r = 'fraco'; // só o número: confere o conteúdo
          else if (nx.length <= 5 && +nx === +P.sif) { var ano = tk[j + 1]; r = (ano && ano.length <= 4 && P.ano && ano.slice(-2) !== P.ano.slice(-2)) ? null : 'forte'; }
        }
        if (!r) return;
        var sub = i >= subDesde; if (sub) r = 'sub';
        if (!melhor || (melhor === 'sub' && r !== 'sub') || (melhor === 'fraco' && r === 'forte')) melhor = r;
      });
      if (!melhor && P.main.length === 8 && base.replace(/\D/g, '').indexOf(P.main) >= 0) melhor = 'forte';
      if (melhor) out.push({ k: k, forte: melhor === 'forte', sub: melhor === 'sub' });
    });
    return out;
  }
  // confere se o número está dentro do arquivo (para os nomes que só trazem o primeiro número)
  async function temNumero(file, num) {
    if (!/\.pdf$/i.test(file.name)) return false;
    try { var P = partesNum(num), doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise, t = '';
      for (var p = 1; p <= Math.min(2, doc.numPages); p++) { var tc = await (await doc.getPage(p)).getTextContent(); t += ' ' + tc.items.map(function (i) { return i.str; }).join(' '); }
      if (t.replace(/\s/g, '').length < 40) return true; // escaneado: aceita e o número é conferido depois de ler
      var d = digitize(norm(t)).replace(/\s+/g, '');
      return new RegExp(P.main + '\\/' + P.sif + '\\/').test(d) || (P.main.length === 8 && d.indexOf(P.main) >= 0);
    } catch (e) { return false; }
  }
  function faltam() {
    var N = necessarios(); if (!N.tem) { alertaPasta('err', 'Carregue primeiro o PSCF ou o Anexo IV.', 'É deles que sai a lista de respaldos da carga.'); return null; }
    if (files.some(function (f) { return f.status === 'lendo'; })) { alertaPasta('', 'Espere terminar a leitura dos arquivos e clique de novo.'); return null; }
    var ja = new Set(files.filter(function (f) { return isResp(f.type); }).map(function (f) { return f.key; }));
    var keys = Object.keys(N.req).filter(function (k) { return !ja.has(k); });
    if (!Object.keys(N.req).length) { alertaPasta('err', 'Não achei números de respaldo no PSCF nem no Anexo IV.'); return null; }
    if (!keys.length) { alertaPasta('ok', 'Todos os ' + Object.keys(N.req).length + ' respaldos da carga já estão carregados.'); return null; }
    return { req: N.req, keys: keys };
  }
  async function escolhe(cands, F) { // um arquivo por certificado: nome forte primeiro, depois PDF, depois o mais recente
    var melhor = function (a, b) { if (a.forte !== b.forte) return a.forte ? a : b; var pa = /\.pdf$/i.test(a.f.name), pb = /\.pdf$/i.test(b.f.name); if (pa !== pb) return pa ? a : b; return a.f.lastModified >= b.f.lastModified ? a : b; };
    var porK = {}; cands.forEach(function (c) { c.ks.forEach(function (x) { (porK[x.k] = porK[x.k] || []).push({ f: c.f, forte: x.forte, sub: x.sub }); }); });
    var por = {}, subs = [];
    for (var k in porK) {
      var sb = porK[k].filter(function (c) { return c.sub; }); porK[k] = porK[k].filter(function (c) { return !c.sub; });
      if (!porK[k].length) { if (sb.length) subs.push(F.req[k] + ' foi substituída (arquivo "' + sb[0].f.name + '")'); continue; }
      var lst = porK[k].slice().sort(function (a, b) { return melhor(a, b) === a ? -1 : 1; });
      for (var i = 0; i < lst.length; i++) { if (lst[i].forte || await temNumero(lst[i].f, F.req[k])) { por[k] = lst[i]; break; } }
    }
    var ach = [], vis = new Set(); Object.keys(por).forEach(function (k) { if (!vis.has(por[k].f)) { vis.add(por[k].f); ach.push(por[k].f); } });
    var nf = F.keys.filter(function (k) { return !por[k]; }).map(function (k) { return F.req[k]; });
    if (subs.length) W0 = 'Atenção: ' + subs.join('; ') + '. Confira se o PSCF está com o número da DCPOA nova. ' + W0;
    if (!ach.length) { alertaPasta('err', 'Não achei nenhum dos ' + F.keys.length + ' respaldos nesta pasta.', 'Procurei pelo número no nome do arquivo (ex.: N0-00598842-3837-26 ou 003364-3837-26): ' + F.keys.map(function (k) { return F.req[k]; }).join(', ') + '. ' + W0); W0 = ''; return; }
    alertaPasta(nf.length ? '' : 'ok', 'Achei ' + Object.keys(por).length + ' de ' + F.keys.length + ' respaldos e coloquei na lista.', (nf.length ? 'Não achei: ' + nf.join(', ') + '. ' : '') + W0); W0 = '';
    var jaConferiu = !$('out').classList.contains('hide');
    ULT = { k: nf.length ? 'warn' : 'ok', t: 'Busca na pasta: achei ' + Object.keys(por).length + ' de ' + F.keys.length + ' respaldos e conferi de novo.', d: (nf.length ? 'Não achei: ' + nf.join(', ') + '. ' : '') + W0 };
    addFiles(ach);
    if (jaConferiu) queue.then(function () { $('run').click(); }); // confere de novo com os respaldos novos
  }
  var REQ = {}, W0 = '', ULT = null;
  var ACEITA = /\.(pdf|jpe?g|png)$/i; // respaldo é PDF ou foto; planilha com o mesmo número (ex.: relatório) fica de fora
  // olha primeiro os arquivos da pasta, depois as subpastas; para quando todos os números foram achados pelo nome completo
  async function varre(dir, keys, out, prof, cont) {
    var subs = [];
    for await (var ent of dir.values()) {
      if (cont.fim) return;
      if (++cont.n > 300000) { cont.cheio = cont.fim = true; return; }
      if (cont.n % 2000 === 0) alertaPasta('', 'Procurando ' + keys.length + ' respaldo(s) na pasta ' + cont.raiz + '…', fmtN(cont.n) + ' arquivos olhados até agora.', true);
      if (ent.kind === 'file') { if (ACEITA.test(ent.name)) { var ks = casaNome(ent.name, keys, REQ); if (ks.length) { out.push({ f: await ent.getFile(), ks: ks }); ks.forEach(function (x) { if (x.forte) cont.fortes.add(x.k); }); if (cont.fortes.size >= keys.length) { cont.fim = true; return; } } } }
      else if (prof < 4 && !/^[.$~]/.test(ent.name)) subs.push(ent);
    }
    for (var i = 0; i < subs.length && !cont.fim; i++) await varre(subs[i], keys, out, prof + 1, cont);
  }
  var DB = function () { return new Promise(function (ok, no) { var r = indexedDB.open('hub-respaldo', 1); r.onupgradeneeded = function () { r.result.createObjectStore('kv'); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; }); };
  async function guarda(h) { try { var db = await DB(); db.transaction('kv', 'readwrite').objectStore('kv').put(h, 'pasta'); } catch (e) {} }
  async function lembrada() { try { var db = await DB(); return await new Promise(function (ok) { var r = db.transaction('kv').objectStore('kv').get('pasta'); r.onsuccess = function () { ok(r.result || null); }; r.onerror = function () { ok(null); }; }); } catch (e) { return null; } }
  // A janela de escolher pasta só abre logo depois do clique: nada de esperar antes de chamá-la.
  var PASTA_H = null, ALT = ' <button class="btn link" data-alt="1">Usar o modo alternativo</button>';
  var FALHOU_NOVO = false, MODO_ALT = false; try { MODO_ALT = localStorage.getItem('hub-pasta-modo') === 'alt'; } catch (e) {}
  function podePicker() { if (MODO_ALT) return false; try { return !!window.showDirectoryPicker && window.self === window.top; } catch (e) { return false; } }
  function modoAlt() { FT_ALT = true; alertaPasta('', 'Escolha a pasta na janela do navegador e confirme em "Carregar".', 'Em pasta grande ou de rede o navegador pode levar alguns segundos para listar os arquivos antes de começar a busca.', true); $('pastaIn').click(); }
  function buscaPasta(outra) {
    var F = faltam(); if (!F) return;
    if (!podePicker()) { modoAlt(); return; }
    var p;
    if (!outra && PASTA_H) { alertaPasta('', 'Abrindo a pasta ' + PASTA_H.name + '…', 'Se o navegador perguntar, permita ver os arquivos.', true); p = PASTA_H.requestPermission({ mode: 'read' }).then(function (r) { if (r !== 'granted') throw Object.assign(new Error('sem permissão'), { name: 'NotAllowedError' }); return PASTA_H; }); }
    else { alertaPasta('', 'Escolha a pasta na janela que abriu.', 'Ex.: M:\\SSF-SIF3403\\Entrada. A busca começa assim que você clicar em Selecionar pasta.', true); p = window.showDirectoryPicker({ id: 'hub-respaldos', mode: 'read' }); }
    p.then(function (dir) { PASTA_H = dir; guarda(dir); mostraUltima(); return procuraEm(dir, F); }).catch(function (e) {
      if (e && e.name === 'AbortError') { alertaPasta('warn', 'A pasta não chegou à ferramenta.', 'Use o modo alternativo ou arraste a pasta do Explorador de Arquivos para esta página.', false, ALT); FALHOU_NOVO = true; return; }
      alertaPasta('warn', 'Não consegui abrir a pasta.', 'Use o modo alternativo ou arraste a pasta do Explorador de Arquivos para esta página.', false, ALT); console.warn(e);
    });
  }
  async function procuraEm(dir, F) {
    alertaPasta('', 'Procurando ' + F.keys.length + ' respaldo(s) na pasta ' + dir.name + '…', 'Em pasta de rede pode levar alguns segundos.', true);
    REQ = F.req; var out = [], cont = { n: 0, fortes: new Set(), raiz: dir.name };
    try { await varre(dir, F.keys, out, 0, cont); } catch (e) { alertaPasta('err', 'Não consegui ler a pasta ' + dir.name + '.', 'Se for pasta de rede, confira se a unidade está conectada no Windows. ' + String(e && e.message || e), false, ALT); return; }
    if (cont.cheio) W0 = 'A pasta tem mais de 300 mil arquivos: escolha uma subpasta mais perto dos respaldos.';
    alertaPasta('', 'Conferindo os arquivos achados…', '', true);
    await escolhe(out, F);
  }
  function mostraUltima() { var b = $('pasta'), o = $('pastaOutra'); if (PASTA_H) { b.lastChild.textContent = 'Buscar respaldos na pasta ' + PASTA_H.name; o.classList.remove('hide'); } }
  // pasta arrastada do Explorador de Arquivos: lê as entradas sem pedir permissão de pasta
  function lerEntradas(dirEnt) { return new Promise(function (ok) { var r = dirEnt.createReader(), tudo = []; (function mais() { r.readEntries(function (lst) { if (!lst.length) ok(tudo); else { tudo = tudo.concat(Array.from(lst)); mais(); } }, function () { ok(tudo); }); })(); }); }
  async function varreEntrada(dirEnt, F, out, prof, cont) {
    var ents = await lerEntradas(dirEnt), subs = [];
    for (var ent of ents) { if (cont.fim) return; cont.n++;
      if (cont.n % 2000 === 0) alertaPasta('', 'Procurando na pasta ' + cont.raiz + '…', fmtN(cont.n) + ' arquivos olhados até agora.', true);
      if (ent.isFile) { if (ACEITA.test(ent.name)) { var ks = casaNome(ent.name, F.keys, F.req); if (ks.length) { out.push({ f: await new Promise(function (ok, no) { ent.file(ok, no); }), ks: ks }); ks.forEach(function (x) { if (x.forte) cont.fortes.add(x.k); }); if (cont.fortes.size >= F.keys.length) { cont.fim = true; return; } } } }
      else if (ent.isDirectory && prof < 4 && !/^[.$~]/.test(ent.name)) subs.push(ent); }
    for (var i = 0; i < subs.length && !cont.fim; i++) await varreEntrada(subs[i], F, out, prof + 1, cont);
  }
  async function soltouPasta(dirs) {
    var m2 = $('pastaMsg2'); if (m2) m2.classList.remove('hide');
    var F = faltam(); if (!F) return;
    alertaPasta('', 'Procurando ' + F.keys.length + ' respaldo(s) na pasta ' + dirs.map(function (d) { return d.name; }).join(', ') + '…', 'Em pasta de rede pode levar alguns segundos.', true);
    REQ = F.req; var out = [], cont = { n: 0, fortes: new Set(), raiz: dirs[0].name };
    try { for (var d of dirs) await varreEntrada(d, F, out, 0, cont); } catch (e) { alertaPasta('err', 'Não consegui ler a pasta arrastada.', String(e && e.message || e)); return; }
    alertaPasta('', 'Conferindo os arquivos achados…', '', true); await escolhe(out, F);
  }
  function pastasDoArraste(e) { var it = e.dataTransfer && e.dataTransfer.items, d = []; if (!it) return d; for (var i = 0; i < it.length; i++) { var en = it[i].webkitGetAsEntry && it[i].webkitGetAsEntry(); if (en && en.isDirectory) d.push(en); } return d; }
  document.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.some.call(e.dataTransfer.types || [], function (t) { return t === 'Files'; })) e.preventDefault(); });
  document.addEventListener('drop', function (e) { var d = pastasDoArraste(e); if (!d.length) { if (!e.target.closest || !e.target.closest('#drop')) e.preventDefault(); return; } e.preventDefault(); e.stopPropagation(); $('drop').classList.remove('over'); soltouPasta(d); }, true);
  $('pasta').onclick = function () { buscaPasta(false); };
  $('pastaOutra').onclick = function () { buscaPasta(true); };
  var FT_ALT = false;
  $('pastaIn').onchange = function () { var F = faltam(); if (!F) { this.value = ''; return; } var out = [];
    if (FT_ALT && FALHOU_NOVO) { MODO_ALT = true; try { localStorage.setItem('hub-pasta-modo', 'alt'); } catch (e) {} } // o jeito novo falhou e este funcionou: usa direto nas próximas
    alertaPasta('', 'Procurando nos ' + fmtN(this.files.length) + ' arquivos da pasta…', '', true);
    Array.prototype.forEach.call(this.files, function (f) { if (ACEITA.test(f.name)) { var ks = casaNome(f.name, F.keys, F.req); if (ks.length) out.push({ f: f, ks: ks }); } }); this.value = ''; escolhe(out, F); };
  $('pastaIn').addEventListener('cancel', function () { alertaPasta('warn', 'Nenhuma pasta chegou à ferramenta.', 'Se você escolheu a pasta, tente arrastá-la do Explorador de Arquivos para cá.'); });
  Promise.race([lembrada(), new Promise(function (ok) { setTimeout(function () { ok(null); }, 2500); })]).then(function (h) { if (h && h.kind === 'directory') { PASTA_H = h; mostraUltima(); } });
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-alt]'); if (b) modoAlt(); });

  /* ---------- extensão Conferência CCS: busca no SIGSIF e na DCPOA (só consulta, com o login do Chrome) ---------- */
  var EXT = { ok: false, rodando: false };
  function extMsg(k, t, d, busy) { var m = $('extMsg'); m.className = 'pmsg ' + (k || '') + (busy ? ' busy' : ''); m.innerHTML = esc(t) + (d ? '<small>' + esc(d) + '</small>' : '') + (busy ? '<div class="pbar"><i></i></div>' : ''); }
  var fmtT = function (ms) { var s = Math.max(1, Math.round(ms / 1000)); if (s < 60) return s + ' s'; var m = Math.floor(s / 60), r = s % 60; return m + ' min' + (r ? ' ' + String(r).padStart(2, '0') + ' s' : ''); };
  function extLiga(v) { if (EXT.ok) return; EXT.ok = true; $('ext').classList.remove('hide'); $('extVer').textContent = v ? '(' + v + ')' : ''; extPreenche(); }
  // com o Anexo IV na lista, a Ref. SIGSIF (item 9.1) e a O.C. de exportação já vêm preenchidas
  function extPreenche() {
    if (!EXT.ok) return; var af = files.find(function (f) { return f.type === 'anexo4' && f.status === 'ok'; }); if (!af) return;
    var A = parseAnexo(af.pages);
    if (A.sigsif && !$('extRef').value) $('extRef').value = A.sigsif;
    if (A.embarque && !$('extOc').value) $('extOc').value = A.embarque;
  }
  window.addEventListener('message', function (ev) {
    var m = ev.data; if (ev.source !== window || !m || !m.__confCcsResp) return;
    if (m.__confCcsResp === 'pronta') extLiga(m.versao);
    if (m.__confCcsResp === 'status') { extLiga(); extMsg(m.erro ? 'err' : '', m.msg || '', m.falta ? 'Falta cerca de ' + fmtT(m.falta) + '.' : '', !m.erro && !m.fim); if (m.erro || m.fim) { EXT.rodando = false; $('extBuscar').disabled = false; } }
    if (m.__confCcsResp === 'arquivos') {
      var lst = [];
      (m.arquivos || []).forEach(function (a) { try { if (!a || !a.b64 || !a.nome) return; var bin = atob(a.b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        var nome = String(a.nome).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120); if (!/\.(pdf|xlsx|xlsm|jpe?g|png)$/i.test(nome)) nome += /pdf/.test(a.mime || '') ? '.pdf' : '';
        lst.push(new File([u], nome, { type: a.mime || 'application/pdf' })); } catch (e) {} });
      EXT.rodando = false; $('extBuscar').disabled = false;
      var av = (m.avisos || []).join(' · ');
      if (!lst.length) { extMsg('err', 'A extensão não trouxe arquivos da O.C. ' + (m.oc || '') + '.', av); return; }
      extMsg(av ? '' : 'ok', 'Chegaram ' + lst.length + ' arquivo(s) da O.C. ' + (m.oc || '') + ': ' + lst.map(function (f) { return f.name; }).join(', ') + '.',
        (av ? 'Avisos: ' + av + '. ' : '') + 'Os CSN e as DCPOAs de trânsito da carga vêm da busca na pasta.');
      var jaConferiu = !$('out').classList.contains('hide');
      addFiles(lst);
      queue.then(function () { extPreenche(); if (jaConferiu) $('run').click(); });
    }
  });
  if (document.documentElement.getAttribute('data-conf-ext')) extLiga(document.documentElement.getAttribute('data-conf-ext'));
  $('extBuscar').onclick = function () {
    var texto = $('extLinhas').value.trim(), oc = $('extOc').value.trim(), ref = $('extRef').value.trim(), dc = $('extDc').value.trim();
    if (!texto && !/\d{5,9}\/\d{3,5}\/20\d{2}/.test(ref) && !/\d{4,7}\/\d{3,5}\/\d{2}/.test(dc)) { extMsg('err', 'Cole a linha da planilha ou informe a Ref. SIGSIF e o Nº da DCPOA emitida.', 'Ref. SIGSIF: 00917486/3403/2026 · DCPOA: 007393/3403/26'); return; }
    EXT.rodando = true; this.disabled = true; extMsg('', 'Pedindo a busca para a extensão…', 'Deixe o SIGSIF (Documentos de Trânsito › Consulta) e a DCPOA (Consultar DCPOA) abertos e logados neste Chrome.', true);
    window.postMessage({ __confCcs: 'buscar', texto: texto, ref: ref, dc: dc, oc: oc, mostrar: false }, '*');
    setTimeout(function () { if (EXT.rodando && /Pedindo a busca/.test($('extMsg').textContent)) { EXT.rodando = false; $('extBuscar').disabled = false; extMsg('err', 'A extensão Conferência CCS não respondeu.', 'Recarregue esta página (F5) e tente de novo. Se continuar, abra o painel da extensão pelo ícone.'); } }, 20000);
  };

  /* ---------- política de privacidade ---------- */
  $('abrePriv').onclick = function (e) { e.preventDefault(); $('privMsg').textContent = ''; try { $('priv').showModal(); } catch (x) { $('priv').setAttribute('open', ''); } };
  $('fechaPriv').onclick = function () { $('priv').close ? $('priv').close() : $('priv').removeAttribute('open'); };
  $('priv').addEventListener('click', function (e) { if (e.target === this) this.close(); });
  $('apagaDados').onclick = function () {
    try { ['hub-nome', 'hub-tema', 'hub-pasta-modo'].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
    try { indexedDB.deleteDatabase('hub-respaldo'); } catch (e) {}
    PASTA_H = null; MODO_ALT = false; var b = $('pasta'); if (b && b.lastChild) b.lastChild.textContent = 'Buscar respaldos na pasta'; $('pastaOutra').classList.add('hide');
    var n = $('nome'); if (n) n.value = '';
    $('privMsg').textContent = 'Pronto: os dados salvos neste navegador foram apagados.';
  };

  render();
  window.__hub = { files: function () { return files; }, parseDcpoa: parseDcpoa, parseHash: parseHash, parseSigExp: parseSigExp, parsePSCF: parsePSCF, parseAnexo: parseAnexo, analyse: analyse, parseRespaldo: parseRespaldo, regra: regra, checaHab: checaHab, regraTxt: regraTxt };
})();
