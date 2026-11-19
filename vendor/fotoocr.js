// Leitura de números em fotos (lacre / contêiner) — PaddleOCR (PP-OCRv3) via ONNX Runtime Web.
// Tudo em JS puro (sem OpenCV) para rodar offline no navegador.
(function (root) {
  'use strict';
  let ORT = null, sDet = null, sCls = null, sRec = null, CHARS = null;

  async function init(ort, models) {
    ORT = ort;
    const opt = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
    sDet = await ort.InferenceSession.create(models.det, opt);
    sCls = models.cls ? await ort.InferenceSession.create(models.cls, opt) : null;
    sRec = await ort.InferenceSession.create(models.rec, opt);
    CHARS = ['blank', ...String(models.keys).split('\n').filter((x, i, a) => !(i === a.length - 1 && x === '')), ' '];
  }
  const ready = () => !!sRec;

  // ---------- imagem ----------
  // img: { data: Uint8ClampedArray RGBA, width, height }
  function resize(img, W, H) {
    const out = new Uint8ClampedArray(W * H * 4), sx = img.width / W, sy = img.height / H, d = img.data, iw = img.width, ih = img.height;
    for (let y = 0; y < H; y++) {
      const fy = Math.min(ih - 1, Math.max(0, (y + 0.5) * sy - 0.5)), y0 = Math.floor(fy), y1 = Math.min(ih - 1, y0 + 1), wy = fy - y0;
      for (let x = 0; x < W; x++) {
        const fx = Math.min(iw - 1, Math.max(0, (x + 0.5) * sx - 0.5)), x0 = Math.floor(fx), x1 = Math.min(iw - 1, x0 + 1), wx = fx - x0;
        const o = (y * W + x) * 4, a = (y0 * iw + x0) * 4, b = (y0 * iw + x1) * 4, c = (y1 * iw + x0) * 4, e = (y1 * iw + x1) * 4;
        for (let k = 0; k < 3; k++) out[o + k] = (d[a + k] * (1 - wx) + d[b + k] * wx) * (1 - wy) + (d[c + k] * (1 - wx) + d[e + k] * wx) * wy;
        out[o + 3] = 255;
      }
    }
    return { data: out, width: W, height: H };
  }
  function rot90(img) { // anti-horário (np.rot90)
    const W = img.height, H = img.width, out = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const i = (y * img.width + x) * 4, nx = y, ny = img.width - 1 - x, o = (ny * W + nx) * 4; out[o] = img.data[i]; out[o + 1] = img.data[i + 1]; out[o + 2] = img.data[i + 2]; out[o + 3] = 255; }
    return { data: out, width: W, height: H };
  }
  function rot180(img) { const out = new Uint8ClampedArray(img.data.length), n = img.width * img.height; for (let i = 0; i < n; i++) { const j = (n - 1 - i) * 4; out[i * 4] = img.data[j]; out[i * 4 + 1] = img.data[j + 1]; out[i * 4 + 2] = img.data[j + 2]; out[i * 4 + 3] = 255; } return { data: out, width: img.width, height: img.height }; }
  // tensor BGR normalizado
  function toTensor(img, mean, std, padW) {
    const W = padW || img.width, H = img.height, n = W * H, t = new Float32Array(3 * n);
    for (let y = 0; y < H; y++) for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4, p = y * W + x;
      const r = img.data[i] / 255, g = img.data[i + 1] / 255, b = img.data[i + 2] / 255;
      t[p] = (b - mean[0]) / std[0]; t[n + p] = (g - mean[1]) / std[1]; t[2 * n + p] = (r - mean[2]) / std[2];
    }
    return new ORT.Tensor('float32', t, [1, 3, H, W]);
  }

  // ---------- detecção ----------
  function convexHull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  function minAreaRect(hull) {
    let best = null;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i], b = hull[(i + 1) % hull.length]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!len) continue;
      const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len, vx = -uy, vy = ux;
      let mnU = Infinity, mxU = -Infinity, mnV = Infinity, mxV = -Infinity;
      for (const q of hull) { const u = q[0] * ux + q[1] * uy, v = q[0] * vx + q[1] * vy; if (u < mnU) mnU = u; if (u > mxU) mxU = u; if (v < mnV) mnV = v; if (v > mxV) mxV = v; }
      const area = (mxU - mnU) * (mxV - mnV);
      if (!best || area < best.area) best = { area, ux, uy, vx, vy, mnU, mxU, mnV, mxV };
    }
    if (!best) { const q = hull[0]; return { cx: q[0], cy: q[1], w: 1, h: 1, ux: 1, uy: 0 }; }
    const cu = (best.mnU + best.mxU) / 2, cv = (best.mnV + best.mxV) / 2;
    return { cx: cu * best.ux + cv * best.vx, cy: cu * best.uy + cv * best.vy, w: best.mxU - best.mnU, h: best.mxV - best.mnV, ux: best.ux, uy: best.uy };
  }
  async function detect(img) {
    const minSide = Math.min(img.width, img.height); let ratio = minSide < 736 ? 736 / minSide : 1;
    if (Math.max(img.width, img.height) * ratio > 1600) ratio = 1600 / Math.max(img.width, img.height);
    const W = Math.max(32, Math.round(img.width * ratio / 32) * 32), H = Math.max(32, Math.round(img.height * ratio / 32) * 32);
    const r = resize(img, W, H);
    const out = await sDet.run({ [sDet.inputNames[0]]: toTensor(r, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]) });
    const prob = out[sDet.outputNames[0]].data;
    // binariza + dilata 2x2
    const bin = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (prob[i] > 0.3 || (x > 0 && prob[i - 1] > 0.3) || (y > 0 && prob[i - W] > 0.3) || (x > 0 && y > 0 && prob[i - W - 1] > 0.3)) bin[i] = 1; }
    const lab = new Int32Array(W * H), boxes = []; let nl = 0; const st = [];
    for (let i0 = 0; i0 < W * H; i0++) {
      if (!bin[i0] || lab[i0]) continue; nl++; lab[i0] = nl; st.push(i0); const pts = []; let sc = 0, cnt = 0;
      while (st.length) {
        const i = st.pop(), x = i % W, y = (i / W) | 0; pts.push([x, y]); sc += prob[i]; cnt++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (bin[j] && !lab[j]) { lab[j] = nl; st.push(j); } }
      }
      if (cnt < 10 || sc / cnt < 0.5) continue;
      const rc = minAreaRect(convexHull(pts)); if (Math.min(rc.w, rc.h) < 3) continue;
      const d = (rc.w * rc.h) * 1.6 / (2 * (rc.w + rc.h)); rc.w += 2 * d; rc.h += 2 * d;
      if (Math.min(rc.w, rc.h) < 5) continue;
      const sxr = img.width / W, syr = img.height / H;
      boxes.push({ cx: rc.cx * sxr, cy: rc.cy * syr, w: rc.w, h: rc.h, ux: rc.ux, uy: rc.uy, sxr, syr });
    }
    return boxes;
  }
  // recorta o retângulo girado (lado longo na horizontal quando possível)
  function crop(img, b) {
    // eixos em coordenadas da imagem original
    let ax = b.ux * b.sxr, ay = b.uy * b.syr; const la = Math.hypot(ax, ay); ax /= la; ay /= la;
    let bx = -b.uy * b.sxr, by = b.ux * b.syr; const lb = Math.hypot(bx, by); bx /= lb; by /= lb;
    let w = b.w * la, h = b.h * lb;
    // orienta: eixo "a" apontando para a direita (leitura da esquerda p/ direita)
    if (ax < 0 || (Math.abs(ax) < 1e-6 && ay < 0)) { ax = -ax; ay = -ay; }
    if (bx * -ay + by * ax < 0) { bx = -bx; by = -by; } // b perpendicular, sentido "para baixo"
    const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h)); const out = new Uint8ClampedArray(W * H * 4), d = img.data, iw = img.width, ih = img.height;
    const ox = b.cx - ax * w / 2 - bx * h / 2, oy = b.cy - ay * w / 2 - by * h / 2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sx = ox + ax * (x + 0.5) + bx * (y + 0.5) - 0.5, sy = oy + ay * (x + 0.5) + by * (y + 0.5) - 0.5;
      const x0 = Math.max(0, Math.min(iw - 1, Math.floor(sx))), y0 = Math.max(0, Math.min(ih - 1, Math.floor(sy))), x1 = Math.min(iw - 1, x0 + 1), y1 = Math.min(ih - 1, y0 + 1), wx = Math.max(0, Math.min(1, sx - x0)), wy = Math.max(0, Math.min(1, sy - y0));
      const o = (y * W + x) * 4, A = (y0 * iw + x0) * 4, B = (y0 * iw + x1) * 4, C = (y1 * iw + x0) * 4, E = (y1 * iw + x1) * 4;
      for (let k = 0; k < 3; k++) out[o + k] = (d[A + k] * (1 - wx) + d[B + k] * wx) * (1 - wy) + (d[C + k] * (1 - wx) + d[E + k] * wx) * wy;
      out[o + 3] = 255;
    }
    let im = { data: out, width: W, height: H };
    if (H / W >= 1.5) im = rot90(im);
    return im;
  }
  async function cls(im) {
    if (!sCls) return im;
    const W = Math.min(192, Math.max(1, Math.ceil(48 * im.width / im.height))); const r = resize(im, W, 48);
    const out = await sCls.run({ [sCls.inputNames[0]]: toTensor(r, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5], 192) });
    const p = out[sCls.outputNames[0]].data; return p[1] > p[0] && p[1] > 0.9 ? rot180(im) : im;
  }
  async function rec(im) {
    const W = Math.max(1, Math.min(1280, Math.ceil(48 * im.width / im.height))); const r = resize(im, W, 48);
    const out = await sRec.run({ [sRec.inputNames[0]]: toTensor(r, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5], Math.max(320, W)) });
    const t = out[sRec.outputNames[0]]; const [, T, C] = t.dims; const p = t.data;
    let txt = '', sc = 0, n = 0, prev = -1;
    for (let i = 0; i < T; i++) { let mi = 0, mv = -1; for (let c = 0; c < C; c++) { const v = p[i * C + c]; if (v > mv) { mv = v; mi = c; } } if (mi !== 0 && mi !== prev) { txt += CHARS[mi] || ''; sc += mv; n++; } prev = mi; }
    return { text: txt.trim(), score: n ? sc / n : 0 };
  }
  async function read(img) {
    const boxes = await detect(img); const res = [];
    for (const b of boxes) { let im = crop(img, b); if (im.width < 4 || im.height < 4) continue; im = await cls(im); const r = await rec(im); if (r.text && r.score >= 0.5) res.push(Object.assign(r, { cx: b.cx, cy: b.cy })); }
    return res;
  }
  // dígito verificador do contêiner (ISO 6346): depende das letras e dos números
  function isoOK(c) { const s = String(c || '').toUpperCase().replace(/\s/g, ''); if (!/^[A-Z]{4}\d{7}$/.test(s)) return null; const val = (ch) => { if (/\d/.test(ch)) return +ch; let v = ch.charCodeAt(0) - 55; v += Math.floor((v - 1) / 10); return v; }; let sum = 0; for (let i = 0; i < 10; i++) sum += val(s[i]) * Math.pow(2, i); return (sum % 11) % 10 === +s[10]; }
  // confere um número esperado contra o que foi lido (ignora pontuação/espaços; aceita 1 dígito diferente como "parecido")
  function confere(lidos, esperado) {
    const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    // letra O lida no lugar de zero (e I/L no lugar de 1) quando está no meio de números
    const fixNum = (t) => t.replace(/(\d)[O](?=\d|$)|(\d)[O]/g, (m) => m.replace('O', '0')).replace(/(\d)[IL](?=\d)/g, (m) => m[0] + '1');
    const all = fixNum(norm(lidos.map((x) => x.text).join(''))), cada = lidos.map((x) => fixNum(norm(x.text)));
    // lacre "026114/SIF2340": o que importa é o número do lacre (antes da barra)
    const alvo = norm(String(esperado || '').split('/')[0]) || norm(esperado);
    const alvos = [alvo].filter(Boolean);
    for (const a of alvos) if (all.includes(a) || cada.some((c) => c.includes(a))) return { status: 'ok', alvo: a };
    // contêiner: prefixo (letras) e número podem vir em pedaços separados
    const runs = (alvo.match(/[A-Z]{4}|\d{6,}/g) || []); if (runs.length >= 2 && runs.every((r) => all.includes(r))) return { status: 'ok', alvo };
    // contêiner: número com dígito verificador lido, mas as letras não
    const cm = /^([A-Z]{4})(\d{7})$/.exec(alvo);
    if (cm && all.includes(cm[2])) return isoOK(alvo) ? { status: 'numero', alvo, letras: cm[1] } : { status: 'iso', alvo, letras: cm[1] };
    const ham = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };
    for (const a of alvos) for (let i = 0; i + a.length <= all.length; i++) if (ham(a, all.slice(i, i + a.length)) === 1) return { status: 'quase', alvo: a, lido: all.slice(i, i + a.length) };
    if (cm) for (let i = 0; i + 7 <= all.length; i++) { const w = all.slice(i, i + 7); if (/^\d{7}$/.test(w) && ham(cm[2], w) === 1) return { status: 'quase', alvo, lido: w }; }
    return { status: lidos.length ? 'diferente' : 'nada', alvo };
  }
  const rotate = (img, k) => { let r = img; for (let i = 0; i < ((k % 4) + 4) % 4; i++) r = rot90(r); return r; };
  const api = { init, ready, read, confere, rotate, _detect: detect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FotoOCR = api;
})(typeof window !== 'undefined' ? window : globalThis);
