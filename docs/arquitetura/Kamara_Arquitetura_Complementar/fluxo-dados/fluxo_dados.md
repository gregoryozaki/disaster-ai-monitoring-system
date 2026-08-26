# Fluxo de dados e classificação da informação

## Categorias de dados

| Categoria | Exemplos | Regra principal |
|---|---|---|
| Identificação | e-mail, nome opcional, papel | não expor publicamente |
| Operacional | ocorrência, GPS, urgência, risco humano | acesso por papel |
| Mídia | foto/vídeo | evidência; storage físico ainda pendente |
| IA | categoria prevista, confiança, explicação, versão | preliminar e rastreável |
| Validação | decisão, motivo, categoria final | autoridade humana |
| Previsão | risco, probabilidade, tendência, fatores | experimental |
| Proveniência | fonte, versão do dataset/modelo | preservar para reprodutibilidade |
| Auditoria | mudanças de status/configuração | append-only na aplicação |

## Projeção pública

A consulta pública deve aplicar uma projeção específica que:

- filtra `status = confirmed`;
- remove identificação do cidadão;
- não retorna e-mail/IDs internos;
- utiliza localização aproximada conforme política implementada;
- diferencia claramente dado validado de estimativa experimental.
