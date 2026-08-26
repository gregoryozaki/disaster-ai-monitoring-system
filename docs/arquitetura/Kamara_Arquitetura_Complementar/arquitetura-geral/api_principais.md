# API principal proposta

> Contrato inicial para orientar implementação. Pode ser refinado durante o código sem mudar os requisitos de negócio.

Base sugerida: `/api/v1`.

## Autenticação

| Método | Endpoint | Papel | Objetivo |
|---|---|---|---|
| POST | `/auth/register` | público | cadastrar cidadão |
| POST | `/auth/login` | público | autenticar usuário |
| POST | `/auth/password/forgot` | público | solicitar recuperação |
| POST | `/auth/password/reset` | público | redefinir senha |
| POST | `/auth/manager/activate` | público com convite | ativar conta de gestor |

## Cidadão / ocorrências

| Método | Endpoint | Objetivo |
|---|---|---|
| POST | `/occurrences` | registrar ocorrência online |
| POST | `/occurrences/sync` | sincronizar ocorrência criada offline com idempotência |
| GET | `/occurrences/mine` | histórico do cidadão |
| GET | `/occurrences/:id` | detalhes/acompanhamento próprio |
| POST | `/occurrences/:id/complements` | responder solicitação de complemento |

## Consulta pública

| Método | Endpoint | Objetivo |
|---|---|---|
| GET | `/public/occurrences` | listar/mapear somente `confirmed` |
| GET | `/public/occurrences/:id` | detalhes públicos minimizados |

## Gestor

| Método | Endpoint | Objetivo |
|---|---|---|
| GET | `/manager/occurrences` | lista/mapa com filtros operacionais |
| GET | `/manager/occurrences/:id` | detalhes completos |
| POST | `/manager/occurrences/:id/validations` | confirmar/corrigir/rejeitar |
| POST | `/manager/occurrences/:id/information-requests` | solicitar complemento |

## Analytics, previsão e exportação

| Método | Endpoint | Objetivo |
|---|---|---|
| GET | `/analytics/summary` | indicadores agregados |
| GET | `/predictions` | previsão regional por tipo/horizonte |
| POST | `/exports` | iniciar exportação CSV/JSON |
| GET | `/exports/:id` | acompanhar job/obter arquivo |

## Administração

| Método | Endpoint | Objetivo |
|---|---|---|
| GET/POST/PATCH | `/admin/managers` | gerir gestores/convites |
| GET/POST/PATCH | `/admin/categories` | gerir categorias COBRADE |
| GET/POST | `/admin/confidence-thresholds` | versionar limiares |
| GET | `/admin/audit` | consultar auditoria/proveniência |

## API interna do serviço de IA

Base separada no FastAPI:

- `POST /classify` — imagem/texto/contexto → classificação preliminar.
- `POST /predict` — dados/atributos regionais → previsão de risco.
- `POST /explain` — XAI avançada quando disponível.
- `GET /health` — saúde do serviço.

O frontend nunca chama o FastAPI diretamente; a integração passa pelo backend principal.
