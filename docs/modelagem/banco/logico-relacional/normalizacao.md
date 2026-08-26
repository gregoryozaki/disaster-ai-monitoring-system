# Normalização

O modelo foi organizado visando **3FN (Terceira Forma Normal)** para o núcleo transacional.

## 1FN

- Campos atômicos nas tabelas operacionais.
- Evidências multimídia são linhas próprias, não listas dentro de `Occurrence`.
- Fontes de uma previsão são modeladas por `PredictionSource`, evitando arrays relacionais.

## 2FN

- Tabelas possuem chave primária própria (`UUID`) ou relacionamento associativo explícito.
- Atributos dependem da entidade identificada pela chave, e não de parte de uma chave composta.

## 3FN

- Categoria COBRADE é uma entidade própria e não texto repetido em ocorrências/classificações.
- Informações de modelo são centralizadas em `ModelVersion`.
- Informações de fonte são centralizadas em `DataSource`.
- Mudanças de status e decisões não são armazenadas em colunas repetitivas da ocorrência; ficam em históricos próprios.

## Uso deliberado de JSON

`signals`, `metrics`, `parameters`, `factors`, `filters` e metadados de proveniência usam `JSON/JSONB` porque representam estruturas variáveis, experimentais ou específicas de modelo. Isso é uma decisão física do protótipo, não uma quebra do núcleo relacional transacional.
