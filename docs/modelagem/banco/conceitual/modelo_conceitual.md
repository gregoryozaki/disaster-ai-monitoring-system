# Modelo conceitual

O modelo conceitual representa o domínio sem depender de Prisma/PostgreSQL.

## Agregado principal: Ocorrência

`Ocorrência` é a entidade central. Ela é registrada por um cidadão e agrega evidências, classificações preliminares da IA, validações humanas, histórico de estados, solicitações de complemento e sinalizações de possível duplicidade/spam.

A separação entre `ClassificaçãoIA` e `Validação` é intencional: a primeira preserva a sugestão automática original; a segunda registra a decisão humana, inclusive quando o gestor corrige a categoria.

## Identidade e acesso

Um único conceito `Usuário` suporta papéis distintos (`CITIZEN`, `MANAGER`, `ADMIN`, `RESEARCHER`). O convite de gestor é modelado separadamente porque a ativação do gestor depende de autorização prévia.

## IA e previsão

`VersãoModelo` permite reprodutibilidade de classificações e previsões. `FonteDado` e `PrevisãoFonte` registram proveniência das fontes ambientais usadas em previsões. `LimiarConfianca` é versionável e pode ser específico por categoria de desastre.

## Auditoria

Mudanças de status possuem entidade própria (`HistoricoStatus`) porque fazem parte do domínio operacional. `Auditoria` é mais genérica e cobre alterações administrativas/configuração.
