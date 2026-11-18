#!/usr/bin/env python3
"""Gera data/habil.json a partir do Manual CCS (abas Modelos e EPOA).

Uso:  MANUAL_SENHA=... python3 gerar_habilitacoes.py <pasta do repositório manual-ccs>
A senha só é usada em memória para abrir o manual; não é gravada.
"""
import base64, gzip, hashlib, json, os, re, sys, unicodedata
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

repo = sys.argv[1] if len(sys.argv) > 1 else '../manual-ccs'
senha = os.environ['MANUAL_SENHA'].strip().upper().encode()
html = open(os.path.join(repo, 'index.html'), encoding='utf-8').read()
P = json.loads(re.search(r'<script id="encdata"[^>]*>(.*?)</script>', html, re.S).group(1))
k = hashlib.pbkdf2_hmac('sha256', senha, base64.b64decode(P['s']), P['it'], 32)
chave = AESGCM(AESGCM(k).decrypt(base64.b64decode(P['wi']), base64.b64decode(P['w']), None))
bruto = chave.decrypt(base64.b64decode(P['iv']), base64.b64decode(P['c']), None)
s = (gzip.decompress(bruto) if bruto[:2] == b'\x1f\x8b' else bruto).decode('utf-8')

def obj(marcador):
    i = s.index(marcador) + len(marcador)
    return json.JSONDecoder().raw_decode(s[i:])[0]

MOD, EPOA = obj('const MOD='), obj('const EPOA=')

def nz(t):
    return unicodedata.normalize('NFD', t or '').encode('ascii', 'ignore').decode().lower()

def forma(r):
    """Mesma leitura da aba Modelos do Manual (habOf)."""
    t = nz(r.get('f', ''))
    o = set()
    if re.search(r'pre.?listing|habilitacao.?dhc|habilitacao - mfds', t): o.add('pre')
    if 'missao' in t: o.add('mis')
    if 'indicacao' in t: o.add('ind')
    if 'monogra' in t: o.add('mon')
    if re.search(r'(^|[^a-z])(br|ue|uee|eua|eu)([^a-z]|$)', t) and 'pre' not in o: o.add('ger')
    if re.search(r'sem acordo|sem csi|nao habilita', t): o.add('sem')
    if not r.get('m') and (len(t) < 3 or re.search(r'sem|nao ha|negocia|fora do sistema', nz(r.get('x', '')))): o.add('sem')
    if o & {'pre', 'mis', 'ind', 'mon'}: return 'esp'
    if 'ger' in o: return 'br' if re.search(r'(^|[^a-z])br([^a-z]|$)', t) else 'ue'
    if 'sem' in o: return 'sem'
    return 'out'

def tipo_modelo(n):
    t = [x.upper() for x in n.split('_')]
    if 'EPOA' in t: return 'epoa'
    k = len(t) - 1
    while k > 0 and re.match(r'^(QRCODE|ANTIGO|V\d+|\d+|NAO|UTILIZAR|QR|CODE)$', t[k].replace('#', '')): k -= 1
    if t[k] == 'BR': return 'br'
    if 'BR' in t: return 'brp'
    if 'UE' in t or 'UEE' in t: return 'ue'
    return 'esp'

out = {'dt': MOD.get('dt', ''), 'pais': {}, 'epoa': {}}
for pais, d in MOD['pais'].items():
    rows = []
    for r in d.get('r', []):
        mods = [m[0] for m in r.get('m', [])]
        rows.append({'e': r.get('e', ''), 'p': r.get('p', ''), 'f': r.get('f', ''), 'cat': forma(r),
                     'mod': mods[:2], 'tm': tipo_modelo(mods[0]) if mods else '', 'i': (r.get('i') or '')[:220]})
    out['pais'][pais] = rows
for pais, d in EPOA.items():
    out['epoa'][pais] = {'c': d.get('c', ''), 'r': [{'p': r.get('p', ''), 'f': r.get('f', ''), 'c': r.get('c', ''), 'i': (r.get('i') or '')[:220]} for r in d.get('r', [])]}

os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data'), exist_ok=True)
dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'habil.json')
json.dump(out, open(dest, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(dest, len(out['pais']), 'países,', len(out['epoa']), 'regras de entreposto, base de', out['dt'])
