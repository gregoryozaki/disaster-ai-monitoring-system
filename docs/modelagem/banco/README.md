# Modelagem de Banco de Dados — Kamara

Esta pasta concentra a documentação conceitual, lógica, física e de
rastreabilidade do banco de dados do Kamara.

A fonte executável do modelo físico não é duplicada dentro de `docs`.

O Prisma Schema oficial está em:

`apps/api/backend/prisma/schema.prisma`

As migrations oficiais estão em:

`apps/api/backend/prisma/migrations/`

## Organização

```text
banco/
├── README.md
│
├── conceitual/
│   ├── 01_der_conceitual.dot
│   ├── 01_der_conceitual.mmd
│   ├── 01_der_conceitual.png
│   └── modelo_conceitual.md
│
├── logico-relacional/
│   ├── 02_der_logico_operacional.dot
│   ├── 02_der_logico_operacional.mmd
│   ├── 02_der_logico_operacional.png
│   ├── 03_der_logico_analytics_admin.dot
│   ├── 03_der_logico_analytics_admin.mmd
│   ├── 03_der_logico_analytics_admin.png
│   ├── modelo_logico_relacional.md
│   └── normalizacao.md
│
├── fisico-prisma/
│   ├── README.md
│   └── regras_indices_constraints.md
│
├── dicionario/
│   ├── dicionario_dados.csv
│   ├── dicionario_dados.xlsx
│   └── entidades_resumo.csv
│
└── rastreabilidade/
    ├── matriz_rastreabilidade_banco.csv
    └── matriz_rastreabilidade_banco.xlsx

```

Níveis da modelagem

A modelagem segue três níveis.

Conceitual

Representa entidades de negócio, conceitos e relacionamentos sem
dependência direta de tecnologia de implementação.

Lógico-relacional

Representa tabelas, atributos, chaves, cardinalidades, relações e
normalização.

Físico

A implementação executável utiliza PostgreSQL e Prisma ORM.

A fonte de verdade é:

apps/api/backend/prisma/schema.prisma

A evolução física do banco é controlada por migrations versionadas em:

apps/api/backend/prisma/migrations/

Não deve existir uma segunda cópia do Prisma Schema dentro da
documentação, pois isso criaria risco de divergência entre o modelo
documentado e o modelo realmente executado.

Premissas centrais
PostgreSQL é o banco relacional principal.
Prisma ORM é utilizado pela API Node.js/Express.
A API backend é autoridade sobre as regras de negócio.
A classificação da IA é preliminar.
A decisão final sobre uma ocorrência é humana.
O mapa público deriva somente de ocorrências CONFIRMED.
Dados operacionais e campos internos não devem ser expostos diretamente
pela consulta pública.
DRAFT e PENDING_SYNC existem no domínio para representar o ciclo de
vida relacionado ao funcionamento offline.
A fila offline pertence principalmente ao armazenamento local da PWA.
clientLocalId permite reconciliar registros locais com registros do
servidor.
idempotencyKey protege o backend contra criação duplicada em retries.
Mídia

Arquivos binários não são armazenados diretamente no PostgreSQL.

OccurrenceMedia mantém os metadados da mídia e um storageRef.

Os bytes são enviados para object storage compatível com a API S3.

No ambiente local, o Kamara utiliza MinIO.

Entre os metadados armazenados estão:

tipo da mídia;
origem;
MIME type;
tamanho;
duração, quando aplicável;
SHA-256;
indicador de mídia principal;
referência física no object storage.

O bucket permanece privado e o acesso ao conteúdo ocorre através da API
após autorização.