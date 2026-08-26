# Offline-first com IndexedDB

**Status:** Aceita

## Contexto

O Kamara é um protótipo acadêmico com PWA, dashboard, backend relacional e serviço de IA desacoplado.

## Decisão

Salvar ocorrência e mídia pendente no navegador; sincronizar depois usando clientLocalId/idempotencyKey.

## Justificativa

Conectividade limitada é requisito central e retries não podem duplicar registros.

## Consequências

- A implementação deve respeitar esta decisão ou registrar um novo ADR substituto.
- Mudanças que afetem requisitos/rastreabilidade devem atualizar a documentação correspondente.
