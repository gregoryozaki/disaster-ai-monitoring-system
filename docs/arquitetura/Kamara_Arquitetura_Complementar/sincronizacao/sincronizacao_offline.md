# Especificação de sincronização offline

## Objetivo

Permitir registro sem internet e sincronização posterior sem perder dados nem criar ocorrências duplicadas.

## Dados locais mínimos

Cada item no IndexedDB deve possuir:

- `clientLocalId` — UUID criado no dispositivo;
- `idempotencyKey` — chave estável do envio;
- payload da ocorrência;
- referências/blobs de mídia local;
- `createdAt`;
- `syncStatus = pending_sync`;
- contagem de tentativas e último erro (telemetria local opcional).

## Algoritmo

1. Usuário envia a ocorrência.
2. Sem conexão, a PWA grava tudo em uma transação local.
3. Ao detectar conectividade, o `SyncManager` lê a fila.
4. Envia para `POST /api/v1/occurrences/sync` com `Idempotency-Key`.
5. Backend verifica se `idempotencyKey`/`clientLocalId` já existem.
6. Se já existe, retorna o mesmo `occurrenceId` — não cria nova ocorrência.
7. Se é nova, cria ocorrência e histórico dentro de transação de banco.
8. Depois solicita pré-análise à IA; falha da IA não desfaz o registro.
9. Backend retorna ACK com `occurrenceId` e estado atual.
10. PWA remove/marca a pendência local como resolvida.

## Falhas

- Falha de rede: mantém `pending_sync` e agenda nova tentativa.
- Timeout/5xx: retry idempotente.
- Erro de validação 4xx: não fazer retry automático infinito; exibir ação de correção.
- IA indisponível: ocorrência permanece válida em análise humana.

## Conflitos

No MVP, o item offline ainda não possui versão concorrente no servidor antes da primeira sincronização. Após sincronizado, atualizações operacionais devem utilizar o servidor como fonte de verdade.
