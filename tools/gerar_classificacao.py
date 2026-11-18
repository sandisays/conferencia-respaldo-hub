#!/usr/bin/env python3
"""Gera data/classif.json a partir da planilha 'Documento Sanitário x Habilitação'.
Uso: python3 gerar_classificacao.py <planilha.xlsx>"""
import openpyxl, json, os, re, sys, unicodedata
def nz(t): return unicodedata.normalize('NFD', str(t)).encode('ascii', 'ignore').decode().upper().replace('\xa0', ' ').strip()
ws = openpyxl.load_workbook(sys.argv[1], data_only=True)['Habilitação']
rows = list(ws.iter_rows(values_only=True))
out = {'cls': {}, 'ue': [], 'uee': []}
for i, r in enumerate(rows):
    r = list(r) + [None] * 9
    for col, key in ((6, 'ue'), (8, 'uee')):
        if i >= 1 and r[col] and len(str(r[col])) < 40: out[key].extend(nz(x) for x in str(r[col]).split('/'))
    if i < 6: continue
    for col, cls in ((0, 1), (2, 2), (4, 3)):
        v = r[col]
        if not v or len(str(v)) > 60: continue
        v = str(v).strip()
        m = re.match(r'^(.*?)\s*(?:\((.*?)\)|-\s*(\w+))\s*$', v)
        nome, q = (m.group(1), m.group(2) or m.group(3)) if m and (m.group(2) or m.group(3)) else (v, '')
        out['cls'].setdefault(nz(nome), []).append({'c': cls, 'q': nz(q), 'n': v})
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'classif.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(len(out['cls']), 'países;', len(out['ue']), 'UE;', len(out['uee']), 'UEE')
