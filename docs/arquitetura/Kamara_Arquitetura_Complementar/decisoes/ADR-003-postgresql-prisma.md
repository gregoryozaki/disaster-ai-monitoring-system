# PostgreSQL + Prisma ORM

**Status:** Aceita

## Contexto

O Kamara é um protótipo acadêmico com PWA, dashboard, backend relacional e serviço de IA desacoplado.

## Decisão

Usar PostgreSQL como banco principal e Prisma como ORM/repositorio de infraestrutura.

## Justificativa

Domínio é relacional e exige histórico/auditoria; Prisma melhora produtividade e migrations.

## Consequências

- A implementação deve respeitar esta decisão ou registrar um novo ADR substituto.
- Mudanças que afetem requisitos/rastreabilidade devem atualizar a documentação correspondente.
