#!/usr/bin/env python3
"""Monta conferencia-respaldo-hub.html (arquivo único, offline)."""
import os
D = os.path.dirname(os.path.abspath(__file__))
r = lambda p: open(os.path.join(D, p), encoding='utf-8').read()
CSP = ("default-src 'none'; script-src 'unsafe-inline' blob: 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; "
       "font-src data: blob:; worker-src blob:; connect-src blob:; form-action 'none'; base-uri 'none'")
html = f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Esta política faz o próprio navegador bloquear qualquer envio de dados para a internet. -->
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<title>Conferência de respaldo do HUB</title>
<style>
{r('vendor/fonts.css')}
{r('src/style.css')}
</style>
</head>
<body>
{r('src/body.html')}
<script>{r('vendor/pdfjs.js')}</script>
<script type="text/plain" id="pdfworker">{r('vendor/pdfworker.txt')}</script>
<script>{r('vendor/jszip.js')}</script>
<script>{r('vendor/tesseract.js')}</script>
<script type="text/plain" id="ocr-worker">{r('vendor/ocr-worker.txt')}</script>
<script type="text/plain" id="ocr-core">{r('vendor/ocr-core.txt')}</script>
<script type="text/plain" id="ocr-lang">{r('vendor/ocr-lang.txt')}</script>
<script>{r('vendor/ort.js')}</script>
<script>{r('vendor/fotoocr.js')}</script>
<script type="text/plain" id="ocrpack">{r('vendor/ocrpack.b64')}</script>
<script type="application/json" id="habil">{r('data/habil.json').replace('</', '<\\/')}</script>
<script type="application/json" id="classif">{r('data/classif.json').replace('</', '<\\/')}</script>
<script>
{r('src/app.js')}
</script>
</body>
</html>
'''
out = os.path.join(D, 'conferencia-respaldo-hub.html')
open(out, 'w', encoding='utf-8').write(html)
print(out, round(len(html) / 1e6, 1), 'MB')
