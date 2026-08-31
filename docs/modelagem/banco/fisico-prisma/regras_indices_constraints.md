# API principal

Base atual da API backend:

`/api/v1`

Este documento distingue contratos já implementados de funcionalidades
ainda planejadas.

## Autenticação

| Método | Endpoint | Papel | Estado | Objetivo |
|---|---|---|---|---|
| POST | `/auth/register` | público | Implementado | cadastrar cidadão |
| POST | `/auth/login` | público | Implementado | autenticar usuário |
| POST | `/auth/logout` | autenticado | Implementado | encerrar sessão |
| GET | `/auth/me` | autenticado | Implementado | consultar usuário da sessão |
| POST | `/auth/password/forgot` | público | Contrato parcial | iniciar recuperação |
| POST | `/auth/password/reset` | público | Planejado | redefinir senha |
| POST | `/auth/manager/activate` | convite | Planejado | ativar conta de gestor |

O cadastro público não aceita `role` nem `status`. Novos usuários
cadastrados publicamente são cidadãos ativos.

## Categorias de desastre

| Método | Endpoint | Estado | Objetivo |
|---|---|---|---|
| GET | `/disaster-categories` | Implementado | listar categorias ativas |

## Cidadão / ocorrências

| Método | Endpoint | Estado | Objetivo |
|---|---|---|---|
| POST | `/occurrences` | Implementado | registrar ocorrência com idempotência |
| GET | `/occurrences` | Implementado | listar ocorrências do cidadão |
| GET | `/occurrences/:id` | Implementado | consultar ocorrência própria |
| GET | `/occurrences/:id/information-requests` | Implementado | consultar solicitações de complemento |
| POST | `/occurrences/:id/information-requests/:requestId/complements` | Implementado | responder solicitação com texto e/ou foto |

O registro inicial é persistido com estado `UNDER_REVIEW`.

A sincronização offline específica da PWA continuará evoluindo sobre os
campos `clientLocalId` e `idempotencyKey`.

## Mídia

| Método | Endpoint | Papel | Estado | Objetivo |
|---|---|---|---|---|
| POST | `/occurrences/:id/media` | cidadão proprietário | Implementado | enviar foto inicial |
| GET | `/occurrences/:id/media` | cidadão proprietário | Implementado | listar mídias próprias |
| GET | `/manager/occurrences/:id/media` | gestor/admin | Implementado | listar mídias operacionais |
| GET | `/media/:mediaId/content` | autenticado autorizado | Implementado | recuperar conteúdo da mídia |

Regras atuais:

- bucket privado;
- JPEG, PNG e WebP;
- validação por conteúdo binário;
- máximo de 10 MB por imagem;
- no máximo uma imagem principal por ocorrência;
- fotos de complemento não são marcadas como principais.

Vídeo permanece planejado para incremento posterior.

## Consulta pública

| Método | Endpoint | Estado | Objetivo |
|---|---|---|---|
| GET | `/public/occurrences` | Implementado | listar somente ocorrências confirmadas |
| GET | `/public/occurrences/:id` | Implementado | consultar detalhe público minimizado |

Somente ocorrências `CONFIRMED` são expostas publicamente.

Estados operacionais como `UNDER_REVIEW`, `NEEDS_MORE_INFO` e
`REJECTED` não são revelados pelas rotas públicas.

## Gestor

| Método | Endpoint | Estado | Objetivo |
|---|---|---|---|
| GET | `/manager/occurrences` | Implementado | listar ocorrências operacionais |
| GET | `/manager/occurrences/:id` | Implementado | consultar detalhe operacional |
| POST | `/manager/occurrences/:id/validations` | Implementado | confirmar, corrigir, rejeitar ou solicitar complemento |
| GET | `/manager/occurrences/:id/media` | Implementado | consultar mídia da ocorrência |

As decisões aceitas são:

- `CONFIRM`;
- `CORRECT`;
- `REJECT`;
- `REQUEST_MORE_INFO`.

`REQUEST_MORE_INFO` cria uma `InformationRequest` e move a ocorrência
para `NEEDS_MORE_INFO`.

Quando o cidadão responde ao pedido, a solicitação passa para
`ANSWERED` e a ocorrência volta a `UNDER_REVIEW`.

## Analytics, previsão e exportação

| Método | Endpoint | Estado |
|---|---|---|
| GET | `/analytics/summary` | Parcial/mock |
| GET | `/predictions` | Parcial/mock |
| POST | `/exports` | Parcial/mock |
| GET | `/exports/:id` | Parcial/mock |

Esses módulos ainda não devem ser considerados persistência operacional
final.

## Administração

Rotas administrativas existem como estrutura inicial, mas a migração
completa para persistência real ainda não está concluída.

## Serviço de IA

A arquitetura prevê FastAPI separado para inferência.

Responsabilidades previstas:

- classificação preliminar;
- previsão de risco;
- explicabilidade;
- health check.

O frontend não deve integrar diretamente com o serviço de IA.
A comunicação passa pela API backend principal.

A IA fornece pré-análise e nunca confirma uma ocorrência por conta
própria. A decisão final continua sendo humana.