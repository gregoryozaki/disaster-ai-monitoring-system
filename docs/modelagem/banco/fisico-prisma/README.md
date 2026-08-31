# Modelo físico com Prisma

A fonte de verdade do modelo físico PostgreSQL do Kamara é:

`apps/api/backend/prisma/schema.prisma`

O histórico de evolução do banco é mantido pelas migrations em:

`apps/api/backend/prisma/migrations/`

Não deve ser mantida uma segunda cópia de `schema.prisma` dentro da
documentação, para evitar divergência entre documentação e código
executável.

## Stack atual

- PostgreSQL 16;
- Prisma ORM 7.10.0;
- `@prisma/client` 7.10.0;
- adapter PostgreSQL `@prisma/adapter-pg`;
- migrations versionadas;
- configuração da datasource através de `prisma.config.ts`.

## Ambientes

O desenvolvimento utiliza o banco PostgreSQL `kamara`.

Os testes de integração utilizam banco separado:

`kamara_test`

Essa separação evita que a suíte automatizada altere dados de
desenvolvimento.

## Migrations atuais

O banco é criado e evoluído exclusivamente através das migrations
versionadas.

Além da migration inicial, existem migrations específicas para:

- unicidade de `OccurrenceComplement.requestId`;
- índice único parcial que garante no máximo uma imagem principal por
  ocorrência.

Constraints que não podem ser representadas diretamente no Prisma
Schema podem ser implementadas através de migration SQL customizada.

## Mídia

Os arquivos binários não são armazenados no PostgreSQL.

A tabela `OccurrenceMedia` mantém somente metadados, incluindo:

- tipo;
- origem;
- MIME type;
- tamanho;
- duração quando aplicável;
- SHA-256;
- indicador de mídia principal;
- `storageRef`.

Os bytes são armazenados em object storage compatível com S3.

No ambiente local é utilizado MinIO.

## Categorias COBRADE

`DisasterCategory` representa as categorias utilizadas pelo sistema.

O seed e/ou mecanismos administrativos devem popular apenas as
categorias COBRADE efetivamente adotadas pelo protótipo.

## Offline e idempotência

A fila offline pertence à PWA e deve ser persistida no armazenamento
local do cliente.

No servidor:

- `clientLocalId` permite reconciliar o registro criado no dispositivo;
- `idempotencyKey` impede duplicação em retries de sincronização.

## Comandos principais

Executados a partir de `apps/api/backend`:

```bash
npx prisma validate
npx prisma format
npx prisma generate
npx prisma migrate status
```

Durante desenvolvimento, quando houver uma alteração intencional no
schema que exija nova migration:

```bash
npx prisma migrate dev --name <nome_da_migration>
```

Em bancos que devem apenas receber migrations já versionadas:

```bash
npx prisma migrate deploy
```