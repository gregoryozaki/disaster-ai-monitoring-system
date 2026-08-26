# Proveniência e versionamento de IA

**Status:** Aceita

## Contexto

O Kamara é um protótipo acadêmico com PWA, dashboard, backend relacional e serviço de IA desacoplado.

## Decisão

Toda inferência relevante referencia ModelVersion; previsões registram fontes de dados.

## Justificativa

Necessário para reprodutibilidade científica e comparação com validação humana.

## Consequências

- A implementação deve respeitar esta decisão ou registrar um novo ADR substituto.
- Mudanças que afetem requisitos/rastreabilidade devem atualizar a documentação correspondente.
