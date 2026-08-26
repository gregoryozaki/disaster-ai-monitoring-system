# Arquitetura geral

## Estilo arquitetural

Arquitetura web modular com backend principal responsável pelo domínio e um serviço de IA isolado. A regra de negócio permanece no backend; o serviço de IA fornece inferências e nunca altera diretamente estados de ocorrência nem confirma registros.

## Containers

- **PWA Cidadão / Mapa Público** — registro, consulta pública, histórico e offline-first.
- **Dashboard Gestor / Administração** — mapa operacional, lista, validação, analytics, previsão e configuração.
- **API Backend** — autenticação, domínio de ocorrências, sincronização, validação, consulta pública, analytics, administração, auditoria e integração com IA.
- **PostgreSQL** — persistência relacional central.
- **Serviço IA** — classificação preliminar, previsão e XAI avançada.

## Sistemas externos

- Serviço de e-mail para ativação/recuperação.
- Fontes ambientais externas para previsão/proveniência.

## Princípios

1. Backend é autoridade do fluxo de negócio.
2. Gestor humano é autoridade da validação.
3. IA é suporte à decisão e deve falhar de forma degradável.
4. Offline-first é requisito de arquitetura, não apenas UX.
5. Dados públicos são uma projeção minimizada dos dados operacionais.
6. Proveniência e versionamento são persistidos para reprodutibilidade.
