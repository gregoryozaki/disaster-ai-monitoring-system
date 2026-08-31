# Arquitetura geral

## Estilo arquitetural

O Kamara utiliza uma arquitetura web modular composta por dois
frontends, uma API backend principal, persistência relacional, object
storage e um serviço de IA desacoplado.

A regra de negócio permanece na API backend.

O serviço de IA fornece inferências e apoio à decisão, mas nunca altera
diretamente o estado oficial de uma ocorrência nem substitui a
validação humana.

## Containers e aplicações

### PWA Cidadão / Mapa Público

Localização:

`apps/mobile/frontend`

Tecnologia principal: Next.js.

Responsabilidades:

- registro de ocorrência;
- captura de mídia;
- histórico do cidadão;
- consulta pública;
- evolução futura do modo offline-first.

### Dashboard Gestor / Administração

Localização:

`apps/dashboard/frontend`

Tecnologia principal: Next.js.

Responsabilidades:

- monitoramento operacional;
- mapa e lista de ocorrências;
- validação humana;
- solicitação de complementos;
- analytics;
- previsão;
- administração.

### API Backend

Localização:

`apps/api/backend`

Tecnologias principais:

- Node.js;
- Express;
- TypeScript;
- Prisma ORM.

Responsabilidades:

- autenticação;
- autorização;
- ocorrências;
- idempotência;
- validação;
- complementos;
- mídia;
- consulta pública;
- integração com PostgreSQL;
- integração com object storage;
- futura integração com IA;
- analytics/admin em evolução.

A API é a autoridade do domínio.

### PostgreSQL

Persistência relacional central.

Armazena:

- usuários;
- ocorrências;
- categorias;
- metadados de mídia;
- classificações;
- validações;
- histórico de estados;
- complementos;
- solicitações de informação;
- entidades de analytics, auditoria e administração.

Os bytes de mídia não são persistidos no PostgreSQL.

### Object Storage

A arquitetura utiliza storage compatível com S3.

No desenvolvimento local:

`MinIO`

Responsabilidades:

- armazenar fotos e posteriormente outros arquivos de mídia;
- manter bucket privado;
- separar conteúdo binário dos metadados relacionais.

A API acessa o storage através de uma abstração em:

`apps/api/backend/src/integrations/storage`

### Serviço de IA

Localização:

`apps/ai-service/backend`

Tecnologia principal: FastAPI / Python.

Responsabilidades previstas:

- classificação preliminar;
- previsão;
- explicabilidade;
- integração com modelos versionados.

A integração efetiva com o workflow operacional ainda está em evolução.

## Sistemas externos previstos

- serviço de e-mail para ativação e recuperação;
- fontes ambientais externas;
- fontes de dados para previsão e proveniência.

## Princípios

1. A API backend é autoridade do fluxo de negócio.
2. O gestor humano é autoridade da validação final.
3. A IA é suporte à decisão e deve falhar de forma degradável.
4. Offline-first pertence à arquitetura da PWA, não apenas à UX.
5. Dados públicos são projeções minimizadas dos dados operacionais.
6. Mídia binária permanece fora do PostgreSQL.
7. Object storage deve permanecer abstraído do domínio.
8. Estados e transições críticas devem ser persistidos e rastreáveis.
9. Idempotência deve proteger retries e sincronizações.
10. Constraints importantes devem ser garantidas também no banco.
11. Proveniência e versionamento devem permitir reprodutibilidade.