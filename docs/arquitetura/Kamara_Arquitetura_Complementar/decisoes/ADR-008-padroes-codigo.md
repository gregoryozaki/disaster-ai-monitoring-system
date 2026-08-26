# Padrões de organização de código

**Status:** Proposta

## Contexto

O Kamara é um protótipo acadêmico com PWA, dashboard, backend relacional e serviço de IA desacoplado.

## Decisão

Service Layer + Repository + Adapter/Gateway + Strategy + DTO/Mapper.

## Justificativa

Mantém componentes do C4 reconhecíveis no código e facilita testes.

## Consequências

- A implementação deve respeitar esta decisão ou registrar um novo ADR substituto.
- Mudanças que afetem requisitos/rastreabilidade devem atualizar a documentação correspondente.
