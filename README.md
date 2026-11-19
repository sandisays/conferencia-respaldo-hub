# Conferência de respaldo do HUB

Ferramenta em um único arquivo HTML, que funciona sem internet, para conferir o respaldo das cargas que saem do armazenador (HUB).

**Usar:** abra `conferencia-respaldo-hub.html` no Edge ou no Chrome e solte os arquivos da carga:

- Relatório PSCF 7446, modelo 4 (Excel ou PDF);
- Anexo IV;
- documentos de respaldo (CSN, CSI, DCPOA, SIGSIF), mesmo escaneados (OCR);
- opcional: ficha do SIF do armazém (Produtos Habilitados para Exportação);
- opcional: HashData (guia de carregamento), DCPOA emitida, SIGSIF da exportação, nota fiscal e croqui;
- também aceita foto (JPG/PNG), lida com OCR.

## O que é conferido

- Se cada certificado usado no PSCF foi carregado, e se o tipo (CSN, CSI ou DCPOA) bate com o número.
- Por lote: presença no documento, rótulo, marca, data de produção, validade e SIF.
- Habilitação conforme a regra do país:
  - lista Brasil: BRASIL ou habilitação maior;
  - lista Brasil com modelo do país: nome do país na habilitação;
  - habilitação específica ou UE: nome do país, e o respaldo tem que ser CSN.
- Habilitação de estocagem do entreposto, pela ficha do SIF.
- Volumes e peso do PSCF dentro do que o documento cobre.
- PSCF × Anexo IV: destino, relatório de embarque, lotes e certificados declarados.
- Documentos da exportação (PSCF × Anexo IV × HashData × DCPOA emitida × SIGSIF): O.C., relatório de embarque, destino, container, lacre, datas e horários, temperaturas, termógrafo, volumes, peso e números cruzados.
- DCPOA emitida: rótulo, marca, volumes, peso, datas, código de rastreabilidade, lotes, destino, respaldos citados (Anexo IV, NF, croqui) e DCPOA de trânsito nas observações.
- Fotos do HashData (ordem de carga, termógrafo, lacre) lidas com OCR, sob demanda.

## Outras funções

- Baixar cada arquivo da lista; baixar o compilado (.zip) com a página e todos os arquivos.
- Imprimir ou baixar a página com marca d'água USO INTERNO SEARA, data e nome de quem conferiu.
- Buscar os respaldos da carga numa pasta (inclusive de rede), pelo número no nome do arquivo.

## Gerar de novo

```
python3 build.py                                    # monta conferencia-respaldo-hub.html
MANUAL_SENHA=... python3 tools/gerar_habilitacoes.py <pasta do manual-ccs>   # atualiza data/habil.json
python3 tools/gerar_classificacao.py <planilha Documento Sanitário x Habilitação.xlsx>  # atualiza data/classif.json
```

A senha do manual nunca vai para arquivo nem commit.

Bibliotecas embutidas (em `vendor/`): pdf.js (Apache-2.0), JSZip (MIT), Tesseract.js e tesseract.js-core (Apache-2.0) e dados de português do Tesseract (MIT).
