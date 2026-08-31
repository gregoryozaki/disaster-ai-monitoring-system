# Estrutura de código

A estrutura abaixo representa a organização atual do repositório e os
principais limites arquiteturais adotados.

```text
apps/
├── mobile/
│   └── frontend/                 # Next.js / PWA cidadão
│
├── dashboard/
│   └── frontend/                 # Next.js dashboard gestor/admin
│
├── api/
│   └── backend/
│       ├── prisma/
│       │   ├── migrations/
│       │   ├── schema.prisma
│       │   └── seed.ts
│       │
│       ├── src/
│       │   ├── config/
│       │   ├── data/
│       │   ├── domain/
│       │   ├── generated/
│       │   │   └── prisma/
│       │   ├── integrations/
│       │   │   ├── ai-service/
│       │   │   └── storage/
│       │   ├── lib/
│       │   ├── middlewares/
│       │   ├── modules/
│       │   │   ├── analytics/
│       │   │   ├── audit/
│       │   │   ├── auth/
│       │   │   ├── complements/
│       │   │   ├── disaster-categories/
│       │   │   ├── media/
│       │   │   ├── occurrences/
│       │   │   ├── risk-predictions/
│       │   │   ├── sync/
│       │   │   ├── users/
│       │   │   └── validation/
│       │   ├── prisma/
│       │   ├── routes/
│       │   ├── schemas/
│       │   ├── services/
│       │   ├── shared/
│       │   └── utils/
│       │
│       └── tests/
│           ├── helpers/
│           ├── integration/
│           └── setup.ts
│
└── ai-service/
    └── backend/
        ├── app/
        │   ├── api/
        │   ├── core/
        │   ├── models/
        │   ├── schemas/
        │   ├── services/
        │   └── utils/
        └── tests/

packages/
├── shared-types/
├── shared-constants/
└── ui/

ml/
├── artifacts/
├── data/
├── evaluation/
├── notebooks/
├── preprocessing/
└── training/


```

Organização do backend

O backend utiliza módulos orientados aos casos de uso do domínio.

Os módulos que já possuem implementação operacional real incluem:

ocorrências;
categorias de desastre;
validação;
complementos;
mídia.

Algumas áreas ainda existem como estrutura ou implementação parcial,
como analytics, administração, previsão e integração com IA.

Padrões adotados
Service Layer

Casos de uso e regras de negócio permanecem fora das rotas HTTP sempre
que possível.

Repository

O acesso ao Prisma pode ser encapsulado por repositories quando houver
benefício claro para o domínio.

Não é necessário criar repository vazio apenas por padronização.

DTO

Respostas HTTP não devem expor diretamente entidades Prisma.

Isso é especialmente importante para:

passwordHash;
reporterId em projeções públicas;
idempotencyKey;
clientLocalId;
storageRef.
Adapter / Gateway

Integrações externas devem ficar atrás de interfaces próprias.

Exemplo atual:

src/integrations/storage

A implementação utiliza S3/MinIO sem acoplar o domínio ao fornecedor.

Middleware

Responsabilidades transversais incluem:

autenticação;
autorização;
validação de payload;
validação de parâmetros de rota;
tratamento centralizado de erros.
Idempotência

idempotencyKey protege a criação de ocorrência contra retries
duplicados.

clientLocalId permite reconciliação futura com o fluxo offline.

Persistência de invariantes

Regras críticas não devem depender apenas da camada HTTP.

Exemplos:

UNIQUE(requestId) em complementos;
índice único parcial para a imagem principal;
transições condicionais de estado nas validações.
Testes

Os testes de integração da API utilizam:

Vitest;
Supertest;
PostgreSQL real em banco separado;
MinIO real em bucket separado.

Ambientes de teste:

banco: kamara_test;
bucket: kamara-media-test.

Os testes são executados de forma serial para evitar competição sobre
os recursos compartilhados do ambiente de integração.