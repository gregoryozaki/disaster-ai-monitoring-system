# Validação humana como autoridade

**Status:** Aceita

## Contexto

O Kamara é um protótipo acadêmico com PWA, dashboard, backend relacional e serviço de IA desacoplado.

## Decisão

IA nunca confirma/rejeita automaticamente; gestor decide e backend aplica transição.

## Justificativa

Confiança não equivale a confirmação e o projeto exige rastreabilidade.

## Consequências

- A implementação deve respeitar esta decisão ou registrar um novo ADR substituto.
- Mudanças que afetem requisitos/rastreabilidade devem atualizar a documentação correspondente.
