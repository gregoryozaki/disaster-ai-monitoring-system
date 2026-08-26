# Modelo lógico/relacional

## Estratégia

O banco relacional é dividido conceitualmente em quatro grupos:

1. **Identidade e acesso** — usuário, convite de gestor e token de recuperação.
2. **Operação de ocorrências** — ocorrência, mídia, classificação IA, validação, histórico, complemento e integridade.
3. **IA e previsão** — versão de modelo, previsão, fontes e limiares.
4. **Auditoria e exportação** — logs de auditoria e jobs de exportação.

## Regras relacionais críticas

- Uma ocorrência pertence a um cidadão (`reporterId`).
- Uma ocorrência pode receber várias classificações automáticas ao longo do tempo; a previsão original nunca é sobrescrita.
- Uma ocorrência pode receber várias decisões humanas, preservando histórico.
- A categoria confirmada atual pode ser mantida em `Occurrence.confirmedCategoryId` para consulta eficiente, enquanto todas as decisões permanecem em `Validation`.
- Toda mudança de status gera `StatusHistory`.
- `clientLocalId`/`idempotencyKey` apoiam sincronização offline idempotente.
- Sinalizações de duplicidade/spam não excluem ocorrências automaticamente.
- Previsões regionais são independentes de uma ocorrência individual e registram versão do modelo e fontes de dados.
