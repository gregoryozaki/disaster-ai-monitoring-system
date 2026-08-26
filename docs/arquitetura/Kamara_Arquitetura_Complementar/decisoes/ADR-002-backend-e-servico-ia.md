# Separar backend principal do serviço de IA

**Status:** Aceita

## Contexto

O Kamara é um protótipo acadêmico com PWA, dashboard, backend relacional e serviço de IA desacoplado.

## Decisão

Express/Prisma mantém domínio e estado; FastAPI/Python expõe apenas inferências.

## Justificativa

Evita acoplamento da regra de negócio ao pipeline científico e permite evolução independente dos modelos.

## Consequências

- A implementação deve respeitar esta decisão ou registrar um novo ADR substituto.
- Mudanças que afetem requisitos/rastreabilidade devem atualizar a documentação correspondente.
