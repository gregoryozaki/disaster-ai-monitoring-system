# Índices e constraints recomendados

## Ocorrências

- `UNIQUE(clientLocalId)` e `UNIQUE(idempotencyKey)` quando presentes: idempotência de sincronização.
- índice `(status, reportedAt)`: lista operacional por estado/recência.
- índice `(confirmedCategoryId, status)`: mapa público/analytics.
- índice `(latitude, longitude)` é apenas básico; se a consulta geográfica crescer, avaliar PostGIS e índice GiST.

## IA

- classificações por `(occurrenceId, createdAt)` para histórico.
- versões de modelo únicas por `(modelType, name, version)`.
- limiares versionados por categoria/modelo.

## Auditoria

- `StatusHistory` deve ser append-only na aplicação.
- `AuditLog` deve ser append-only, salvo manutenção administrativa excepcional.
- ocorrências `rejected` não são excluídas automaticamente.

## Privacidade

O banco armazena localização operacional. A aproximação/mascaramento para mapa público deve ocorrer na camada de consulta pública, sem duplicar necessariamente coordenadas públicas na tabela.
