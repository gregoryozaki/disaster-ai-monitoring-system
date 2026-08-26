# Estrutura de código recomendada

Esta é uma proposta de implementação coerente com o C4 já definido.

```text
apps/
├── citizen-web/              # Next.js / PWA cidadão + mapa público
├── dashboard-web/            # Next.js gestor/admin/pesquisa
├── api/                      # Node.js + Express + Prisma
│   └── src/
│       ├── modules/
│       │   ├── auth/
│       │   ├── occurrences/
│       │   ├── sync/
│       │   ├── validation/
│       │   ├── public-map/
│       │   ├── analytics/
│       │   ├── predictions/
│       │   ├── exports/
│       │   └── admin/
│       ├── infrastructure/
│       │   ├── prisma/
│       │   ├── ai-client/
│       │   └── email/
│       └── shared/
└── ai-service/               # FastAPI / Python
    └── app/
        ├── api/
        ├── orchestration/
        ├── classification/
        ├── prediction/
        ├── explainability/
        └── models/

packages/
└── contracts/                # tipos/DTOs compartilháveis quando útil

ml/
├── datasets/
├── training/
├── evaluation/
└── artifacts/
```

## Padrões recomendados

- **Service Layer** para casos de uso do backend.
- **Repository** sobre Prisma para isolamento de persistência.
- **Adapter/Gateway** para IA, e-mail e fontes externas.
- **Strategy** para troca/avaliação de modelos de IA.
- **DTO + Mapper** nas fronteiras HTTP.
- **Idempotency Key** na sincronização offline.
- Histórico e auditoria append-only na aplicação.
