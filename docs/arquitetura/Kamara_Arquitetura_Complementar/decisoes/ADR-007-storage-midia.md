# Storage físico de mídia

**Status:** Pendente

## Contexto

O Kamara é um protótipo acadêmico com PWA, dashboard, backend relacional e serviço de IA desacoplado.

## Decisão

Manter storageRef abstrato no domínio até escolher filesystem/object storage.

## Justificativa

Evita inventar infraestrutura antes da necessidade; decisão deve ocorrer antes da implementação real de upload.

## Consequências

- A implementação deve respeitar esta decisão ou registrar um novo ADR substituto.
- Mudanças que afetem requisitos/rastreabilidade devem atualizar a documentação correspondente.
