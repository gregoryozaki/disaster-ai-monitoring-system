# Modelo físico com Prisma

`schema.prisma` é a proposta de implementação física do modelo no PostgreSQL.

## Antes da primeira migration

1. Definir `DATABASE_URL`.
2. Revisar quais papéis estarão ativos no MVP (`RESEARCHER` pode compartilhar acesso com dashboard ou ser removido inicialmente).
3. Definir estratégia física para `OccurrenceMedia.storageRef` (filesystem no protótipo, object storage ou outro serviço).
4. Popular `DisasterCategory` com os códigos COBRADE que serão efetivamente usados no protótipo.
5. Definir limiares iniciais de confiança por categoria somente após decisão explícita; não usar 70% universal por padrão.

## Comandos esperados quando o backend for iniciado

```bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name init
npx prisma generate
```

## Observação sobre offline

A fila `pending_sync` fica no IndexedDB da PWA. O PostgreSQL recebe a ocorrência após sincronização. `clientLocalId` e `idempotencyKey` existem no modelo servidor para reconciliar o item local e impedir criação duplicada em retries.
