# Checklist de arquitetura e implementação

Este documento começou como checklist anterior à implementação.

Como o desenvolvimento do Kamara já foi iniciado, ele passa a registrar
o estado das principais decisões arquiteturais e dos incrementos do
protótipo.

## Modelagem e documentação base

- [x] Requisitos e histórias consolidados.
- [x] Telas e fluxos principais definidos.
- [x] Diagramas MoLIC.
- [x] Casos de uso.
- [x] Diagramas de estados.
- [x] Diagramas de sequência.
- [x] Diagramas de atividades.
- [x] C4 de contexto, contêineres, componentes e código.
- [x] Modelo conceitual do banco.
- [x] Modelo lógico-relacional.
- [x] Modelo físico com Prisma.
- [x] API principal definida.
- [x] Estratégia offline/sincronização definida arquiteturalmente.

## Infraestrutura

- [x] Monorepo/workspaces criado.
- [x] Docker Compose configurado.
- [x] PostgreSQL disponível no ambiente local.
- [x] Banco de desenvolvimento criado.
- [x] Banco separado para testes de integração.
- [x] Prisma ORM integrado ao backend.
- [x] Migrations versionadas.
- [x] MinIO integrado como object storage local.
- [x] Bucket privado para mídia de desenvolvimento.
- [x] Bucket separado para testes de integração.
- [ ] Serviço de e-mail definido e integrado.
- [ ] Infraestrutura de produção definida.

## Backend principal

### Autenticação

- [x] Cadastro público de cidadão.
- [x] Login.
- [x] Sessão por cookie HttpOnly.
- [x] Consulta do usuário autenticado.
- [x] Controle de papéis.
- [x] Cadastro público impedido de escolher `role` ou `status`.
- [ ] Convite e ativação completa de gestor.
- [ ] Recuperação de senha completa com envio de e-mail.

### Ocorrências

- [x] Registro de ocorrência.
- [x] Persistência PostgreSQL.
- [x] `clientLocalId`.
- [x] `idempotencyKey`.
- [x] Proteção contra criação duplicada.
- [x] Listagem das ocorrências do cidadão.
- [x] Consulta de ocorrência própria.
- [x] Restrição de acesso entre cidadãos.
- [x] Estado inicial `UNDER_REVIEW`.
- [ ] Sincronização offline completa da PWA.

### Validação humana

- [x] Listagem operacional para gestor.
- [x] Consulta operacional de ocorrência.
- [x] Confirmação.
- [x] Correção de categoria.
- [x] Rejeição.
- [x] Solicitação de informações adicionais.
- [x] Histórico de transições.
- [x] Proteção contra revalidação de ocorrência já finalizada.
- [x] Atualizações condicionais para reduzir conflitos concorrentes.

A decisão final permanece humana.

### Complementos

- [x] Criação de `InformationRequest`.
- [x] Estado `NEEDS_MORE_INFO`.
- [x] Resposta do cidadão com texto.
- [x] Resposta do cidadão com foto.
- [x] Resposta com texto e foto.
- [x] Uma resposta por `InformationRequest`.
- [x] Retorno da ocorrência para `UNDER_REVIEW`.
- [x] Encerramento da solicitação como `ANSWERED`.

Uma nova rodada de esclarecimento deve criar uma nova
`InformationRequest`.

### Mídia

- [x] Object storage S3-compatible definido.
- [x] MinIO adotado no ambiente local.
- [x] Bucket privado.
- [x] Abstração de storage no backend.
- [x] Upload de foto inicial.
- [x] Foto complementar.
- [x] JPEG.
- [x] PNG.
- [x] WebP.
- [x] Validação por conteúdo binário.
- [x] Limite de 10 MB por imagem.
- [x] SHA-256.
- [x] Uma imagem principal por ocorrência.
- [x] Constraint física no PostgreSQL para imagem principal.
- [x] Download autorizado através da API.
- [x] `storageRef` não exposto no contrato HTTP.
- [x] Remoção compensatória do objeto quando a persistência falha.
- [ ] Vídeo.
- [ ] Streaming de mídia de maior porte.

### Consulta pública

- [x] Listagem pública.
- [x] Consulta pública individual.
- [x] Apenas ocorrências `CONFIRMED`.
- [x] Ocorrências operacionais não expostas.
- [x] Campos internos/sensíveis removidos do DTO público.
- [ ] Política final de aproximação/mascaramento geográfico, se necessária.

### Categorias COBRADE

- [x] Entidade persistida.
- [x] Endpoint de categorias.
- [x] Validação de categorias no fluxo operacional.
- [ ] Catálogo definitivo do protótipo revisado e congelado.

## Serviço de IA

- [x] Serviço FastAPI separado na arquitetura.
- [x] Estrutura inicial do serviço criada.
- [ ] Integração efetiva API Backend → Serviço IA.
- [ ] Classificação visual real.
- [ ] Classificação textual real.
- [ ] Estratégia multimodal.
- [ ] Versionamento operacional de modelos.
- [ ] Pipeline de previsão de risco.
- [ ] Explicabilidade/XAI integrada.

A IA deve produzir pré-análise e nunca confirmar automaticamente uma
ocorrência.

## Frontends

### PWA cidadão

- [x] Estrutura Next.js criada.
- [x] Telas iniciais implementadas.
- [x] Manifesto PWA.
- [ ] Integração completa com a API real.
- [ ] IndexedDB.
- [ ] Fila offline.
- [ ] Sincronização automática.
- [ ] Pipeline real de classificação.

### Dashboard

- [x] Estrutura Next.js criada.
- [x] Telas iniciais implementadas.
- [ ] Substituição completa dos mocks pela API real.
- [ ] Fluxo operacional completo conectado ao backend.
- [ ] Analytics real.
- [ ] Previsões reais.
- [ ] Administração real.

## Analytics, exportação e administração

- [ ] Migrar analytics restante de mock para persistência real.
- [ ] Migrar predictions para persistência/modelos reais.
- [ ] Implementar exportação persistida.
- [ ] Implementar administração de gestores.
- [ ] Implementar administração de categorias.
- [ ] Implementar limiares versionados.
- [ ] Implementar auditoria operacional completa.

## Testes e qualidade do backend

- [x] Vitest configurado.
- [x] Supertest configurado.
- [x] Banco PostgreSQL separado para testes.
- [x] Bucket MinIO separado para testes.
- [x] Reset seguro dos recursos entre testes.
- [x] Testes executados serialmente.
- [x] Testes de autenticação.
- [x] Testes de ocorrências.
- [x] Testes de consulta pública.
- [x] Testes de validação.
- [x] Testes de complementos.
- [x] Testes de mídia.
- [x] 48 testes de integração passando.
- [x] TypeScript/typecheck.
- [x] ESLint.
- [x] Prettier.
- [x] Build.
- [x] Auditoria das dependências de runtime sem vulnerabilidades conhecidas
  quando excluídas dependências de desenvolvimento e opcionais.

## Próximos incrementos

Antes de ampliar o escopo funcional:

1. manter documentação e código sincronizados;
2. atualizar diagramas de arquitetura e fluxo com PostgreSQL, MinIO,
   mídia e complementos;
3. concluir integração dos frontends com o backend real;
4. implementar sincronização offline;
5. integrar o serviço de IA ao fluxo de pré-análise;
6. adicionar vídeo somente quando houver necessidade funcional clara;
7. substituir módulos restantes baseados em mock.