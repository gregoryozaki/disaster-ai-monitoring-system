# Modelagem de Banco de Dados — Kamara

Pacote preparado para ser extraído diretamente em `docs/modelagem/banco`.

## Organização

```text
banco/
├── README.md
├── conceitual/
│   ├── 01_der_conceitual.png
│   ├── 01_der_conceitual.mmd
│   └── modelo_conceitual.md
├── logico-relacional/
│   ├── 02_der_logico_operacional.png
│   ├── 02_der_logico_operacional.mmd
│   ├── 03_der_logico_analytics_admin.png
│   ├── 03_der_logico_analytics_admin.mmd
│   ├── modelo_logico_relacional.md
│   └── normalizacao.md
├── fisico-prisma/
│   ├── schema.prisma
│   ├── README.md
│   └── regras_indices_constraints.md
├── dicionario/
│   ├── dicionario_dados.csv
│   └── entidades_resumo.csv
└── rastreabilidade/
    └── matriz_rastreabilidade_banco.csv
```

A modelagem segue três níveis:

1. **Conceitual** — entidades de negócio e relações, sem tecnologia.
2. **Lógico/relacional** — tabelas, PK/FK, cardinalidades e normalização.
3. **Físico** — implementação proposta em PostgreSQL usando Prisma ORM.

## Premissas centrais

- PostgreSQL é o banco relacional principal.
- Prisma é a camada ORM do backend Node.js/Express.
- A classificação da IA é **preliminar**; a decisão final é humana.
- `draft` e `pending_sync` pertencem principalmente ao armazenamento local IndexedDB, mas permanecem no enum de domínio para rastreabilidade do ciclo de vida.
- O backend usa `clientLocalId` e `idempotencyKey` para evitar duplicidade na sincronização offline.
- O mapa público é derivado somente de ocorrências `confirmed` e nunca expõe dados pessoais.
- A referência física de mídia (`storageRef`) foi mantida abstrata porque o storage dedicado ainda não foi decidido.
