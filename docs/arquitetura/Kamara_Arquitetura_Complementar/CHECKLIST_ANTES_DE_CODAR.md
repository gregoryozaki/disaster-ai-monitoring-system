# Checklist antes de iniciar implementação

## Fechado

- [x] Requisitos e histórias consolidados
- [x] Telas/fluxos
- [x] MoLIC
- [x] Casos de uso
- [x] Estados
- [x] Sequência
- [x] Atividades
- [x] C4 contexto/contêineres/componentes/código
- [x] Modelo conceitual/lógico/físico do banco
- [x] API principal proposta
- [x] Estratégia offline/sincronização

## Decisões ainda necessárias antes de implementar upload real

- [ ] Escolher storage físico de fotos/vídeos (`storageRef`).
- [ ] Confirmar catálogo/códigos COBRADE iniciais.
- [ ] Definir política inicial de limiares por categoria (sem assumir 70% universal).
- [ ] Definir provedor de e-mail no ambiente de desenvolvimento.

## Próxima etapa recomendada

1. Criar workspace/monorepo e Docker Compose.
2. Subir PostgreSQL.
3. Copiar `schema.prisma` para o backend e executar migration inicial.
4. Implementar autenticação mínima.
5. Implementar CRUD/registro de ocorrência sem IA.
6. Implementar dashboard/lista/validação.
7. Implementar mapa público `confirmed`.
8. Implementar sincronização offline.
9. Integrar serviço IA primeiro com resposta simulada, depois modelos reais.
