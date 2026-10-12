# Histórias de Usuário e Requisitos — Protótipo Kamara

**Projeto:** Sistema web para registro, triagem, monitoramento e previsão preliminar de desastres ambientais urbanos  
**Versão:** 2.0 — requisitos consolidados e rastreáveis  
**Escopo:** Protótipo acadêmico PIBIC; dados operacionais e preditivos sintéticos/simulados nesta fase  
**Foco inicial de implementação:** queimadas/incêndios e alagamentos/inundações  
**Base de requisitos:** Mapeamento Sistemático da Literatura + levantamento com profissionais (`n = 13`) + telas/fluxos do protótipo + decisões arquiteturais do projeto  
**Fora do MVP:** integração institucional oficial e operação como sistema oficial de alerta.

---

## 0. Origem dos requisitos e critérios de decisão

Os requisitos deste documento não são derivados de uma única fonte. A consolidação utiliza quatro tipos de evidência:

| Sigla | Fonte | Papel na derivação |
|---|---|---|
| `FORM` | Levantamento com 13 participantes | Necessidades, prioridades, restrições de uso e confiança |
| `MSL` | Mapeamento Sistemático com 42 estudos primários | Fundamentação técnica, tipos de dados, IA, métricas e lacunas |
| `DESIGN` | Telas e fluxos já projetados | Validação da cobertura funcional da interface |
| `ARQ` | Decisões arquiteturais do protótipo | Restrições técnicas e separação entre aplicação, backend e IA |

### 0.1 Evidências mais relevantes do levantamento com usuários

- **Operação sem conectividade é crítica:** 12/13 responderam que é comum faltar internet em campo e 1/13 respondeu “às vezes”. Consequentemente, armazenamento local e sincronização deixam de ser funcionalidades secundárias.
- **Mapa e painel são as telas mais valorizadas:** mapa em tempo real foi selecionado por 12/13 (92,3%), painel analítico por 10/13 (76,9%), lista de ocorrências por 8/13 (61,5%) e previsão por 7/13 (53,8%).
- **Campos prioritários no registro:** foto 12/13 (92,3%), GPS automático 11/13 (84,6%), nível de urgência 9/13 (69,2%), vídeo 9/13 (69,2%) e indicação de vítimas/risco humano 8/13 (61,5%).
- **Filtros prioritários no mapa:** tipo de desastre 11/13 (84,6%), data/período 9/13 (69,2%) e raio/distância 7/13 (53,8%).
- **Confiança e transparência são relevantes:** confiança percentual e evidência visual foram selecionadas por 10/13 (76,9%) cada. Para a forma de explicação, 11/13 escolheram explicação simples ou duas versões (simples + técnica).
- **Previsão:** 24–48 h foi o horizonte mais selecionado (9/13; 69,2%), seguido de 7 dias (6/13; 46,2%). Para tornar a previsão utilizável, o item mais escolhido foi alerta regional em níveis baixo/médio/alto (9/13; 69,2%), seguido de histórico comparativo (7/13; 53,8%).
- **Validação humana permanece central:** equipe interna foi indicada por 9/13 e equipes de campo por 6/13. As respostas sobre regra de confirmação dividiram-se principalmente entre confiança ≥80% (5/13) e regra dependente do tipo de desastre (5/13), não sustentando um limiar global fixo.
- **Consulta pública exige cautela:** “somente alertas confirmados” foi a opção individual mais selecionada (5/13), enquanto 3/13 preferiram não exibir ocorrências próximas por risco de pânico/desinformação. O protótipo adota a alternativa conservadora de publicar apenas registros confirmados.
- **Aderência ao protótipo:** 9/13 avaliaram a utilidade com nota 4 ou 5 e 11/13 aceitaram participar de testes de protótipo.

### 0.2 Evidências do Mapeamento Sistemático

O corpus final do MSL contém 42 estudos. Os desastres climatológicos foram os mais frequentes (25 ocorrências), seguidos pelos hidrológicos (21) e geológicos (17), apoiando o recorte inicial em incêndios/queimadas e inundações/alagamentos. O MSL também aponta uso recorrente de Deep Learning, Machine Learning clássico, Visão Computacional, XAI e abordagens híbridas, além da necessidade de integração de dados heterogêneos.

As principais implicações para o protótipo são:

- uso da **COBRADE** como referência de classificação;
- integração progressiva de dados históricos, meteorológicos/hidrológicos, satelitais e relatos de cidadãos;
- IA como **suporte à decisão**, sem substituir validação humana;
- associação entre tipo de dado, fase do ciclo do desastre e técnica algorítmica;
- necessidade de considerar conectividade limitada e custo computacional;
- avaliação dos modelos com métricas adequadas ao risco: precisão, recall, F1, matriz de confusão e, quando aplicável, AUC/IoU;
- rastreabilidade, reprodutibilidade, versão do modelo e explicitação de limitações;
- XAI como requisito relevante para confiança, porém tratada como evolução quando exceder o escopo do MVP.

### 0.3 Regra de priorização

A prioridade abaixo considera **valor para usuários + evidência da literatura + dependência arquitetural + viabilidade de PIBIC**. Portanto, um requisito pode ter forte demanda do formulário e ainda ser classificado como evolução por custo técnico, como ocorre com XAI avançada.

---

## 1. Visão geral do sistema

Será composto por dois ambientes principais:

1. **Aplicativo web responsivo/PWA para cidadãos**  
   Permite registrar ocorrências com evidência visual, descrição contextual, localização, data/hora, nível de urgência e indicação de risco humano. O aplicativo deve continuar utilizável em conectividade limitada, armazenando registros localmente quando necessário. Também permite acompanhar o status e consultar ocorrências públicas confirmadas.

2. **Dashboard web para gestores ambientais**  
   Permite visualizar ocorrências em mapa e lista, filtrar por tipo, período, distância/região, status e confiança, analisar detalhes, confirmar/rejeitar registros, acompanhar indicadores e consultar previsões experimentais de risco.

3. **Serviço de IA e previsão**  
   Responsável por classificação preliminar e previsão experimental. Deve expor confiança/nível de risco e manter rastreabilidade do modelo e das entradas utilizadas.

A IA atua como **apoio à triagem e à decisão**, não como autoridade final. A confirmação da ocorrência é feita por gestor humano. O sistema deve diferenciar claramente evidência observada, inferência automática e validação humana.

---

## 2. Papéis do sistema

| Papel | Descrição |
|---|---|
| Cidadão | Usuário que registra ocorrências ambientais e consulta ocorrências confirmadas próximas. |
| Gestor Ambiental | Usuário responsável por analisar, validar, rejeitar ou solicitar complemento de ocorrências. |
| Administrador | Usuário técnico responsável por configurações, manutenção de categorias, usuários e parâmetros do sistema. |
| Sistema de IA | Componente responsável por classificação preliminar de ocorrências e previsão de risco. |
| Sistema de Sincronização | Componente responsável por armazenar registros offline e sincronizá-los posteriormente. |

---

## 3. Estados de uma ocorrência

| Status | Descrição |
|---|---|
| `draft` | Ocorrência criada localmente, mas ainda não enviada. |
| `pending_sync` | Ocorrência registrada sem internet e aguardando sincronização. |
| `synced` | Ocorrência enviada ao servidor. |
| `under_review` | Ocorrência em análise pelo gestor. |
| `confirmed` | Ocorrência confirmada pelo gestor. |
| `rejected` | Ocorrência rejeitada pelo gestor. |
| `needs_more_info` | Gestor solicitou mais informações ao cidadão. |

---

## 4. Regras de negócio gerais

| Código | Regra de negócio |
|---|---|
| RN01 | A IA não confirma ocorrências automaticamente; ela fornece classificação/risco preliminar para apoio à decisão. |
| RN02 | Apenas ocorrências `confirmed` devem aparecer no mapa público do cidadão no protótipo inicial. |
| RN03 | Ocorrências `under_review`, `pending_sync`, `rejected` ou `needs_more_info` não devem aparecer no mapa público. |
| RN04 | Toda ocorrência deve possuir data/hora e localização; o formulário deve registrar também nível de urgência e permitir indicar vítimas/risco humano. |
| RN05 | Foto é a evidência visual prioritária do registro. Quando indisponível, o sistema pode aceitar registro sem foto, porém deve marcá-lo para análise humana e não executar classificação visual. |
| RN06 | Vídeo pode ser anexado como evidência complementar; áudio permanece opcional/futuro. |
| RN07 | O sistema deve registrar histórico de alterações de status e decisões relevantes. |
| RN08 | A previsão de risco deve ser apresentada como estimativa experimental, não como alerta oficial. |
| RN09 | O sistema deve indicar quando dados, previsões ou cenários forem sintéticos/simulados. |
| RN10 | O gestor deve poder sobrescrever a classificação preliminar sugerida pela IA. |
| RN11 | O cidadão não deve conseguir confirmar a própria ocorrência. |
| RN12 | Ocorrências rejeitadas devem ser preservadas para auditoria interna, salvo exclusão administrativa justificada. |
| RN13 | O mapa público deve priorizar segurança informacional e evitar divulgação de ocorrências não verificadas. |
| RN14 | Em ausência de internet, a ocorrência deve poder ser salva localmente e sincronizada posteriormente. |
| RN15 | O sistema deve diferenciar explicitamente “classificação preliminar”, “em análise” e “ocorrência confirmada”. |
| RN16 | O escopo inicial de classificação operacional é `incendio_queimada` e `inundacao_alagamento`; a estrutura deve permitir expansão compatível com COBRADE. |
| RN17 | Filtros de mapa/lista devem incluir pelo menos tipo de desastre e data/período; raio/distância deve estar disponível onde houver contexto geográfico. |
| RN18 | Limiar de confiança não deve ser fixado globalmente em 70%; deve ser configurável e, quando necessário, específico por tipo de desastre. |
| RN19 | Confiança automática nunca equivale a confirmação humana. |
| RN20 | A pré-análise deve apresentar confiança percentual quando disponível e uma explicação compreensível ao gestor/cidadão; XAI avançada pode ser adicionada em fase posterior. |
| RN21 | A previsão deve priorizar horizonte de 24–48 h e pode oferecer 7 dias como horizonte complementar no protótipo. |
| RN22 | A previsão deve apresentar nível de risco baixo/médio/alto; probabilidade, tendência e histórico comparativo são complementos desejáveis. |
| RN23 | Fontes externas devem possuir identificação de origem/proveniência e instante de atualização. |
| RN24 | O sistema deve tratar duplicidade, spam e entradas inválidas sem eliminar evidência necessária para auditoria. |
| RN25 | O tempo de pré-análise deve ser informado ao usuário; a meta do protótipo é resposta em até 5 minutos, buscando retorno quase imediato quando tecnicamente viável. |
| RN26 | Modelos devem ser avaliados com métricas além de acurácia, incluindo recall e F1; para visão computacional, usar métricas adequadas à tarefa, como IoU quando aplicável. |
| RN27 | O sistema deve registrar a versão do modelo utilizada em cada inferência relevante. |
| RN28 | O protótipo deve ser responsivo e tolerante a conectividade limitada, coerente com uso em campo. |

---

# 5. Épico A — Registro de ocorrências pelo cidadão

## HU01 — Registrar ocorrência ambiental

**Como cidadão, gostaria de registrar uma ocorrência ambiental com localização, evidências e informações de urgência, para que gestores possam realizar triagem e validação com dados suficientes.**

**Origem principal:** `FORM + DESIGN`

### Critérios de aceitação

- Dado que estou na tela de registro, quando informo ou autorizo a localização, então o sistema deve registrar coordenadas ou ponto informado.
- Dado que realizo o registro, então data/hora devem ser preenchidas automaticamente.
- Dado que estou preenchendo a ocorrência, então devo poder informar nível de urgência e se há vítimas/risco humano.
- Dado que a câmera/arquivo está disponível, então devo poder anexar foto como evidência principal e vídeo como evidência complementar.
- Dado que informo descrição textual, então ela deve ser armazenada como contexto adicional e pode alimentar análise textual.
- Dado que envio uma ocorrência, então o sistema deve exibir mensagem de sucesso ou informar claramente que o registro ficou pendente de sincronização.
- Dado que a ocorrência chega ao servidor, então ela deve ficar disponível no dashboard para análise humana.

### Regras de negócio

- Localização e data/hora são obrigatórias.
- Foto é fortemente priorizada; ausência de foto não deve impedir o registro quando houver limitação técnica, mas deve impedir classificação visual e pode reduzir a confiança da triagem.
- Nível de urgência deve utilizar escala padronizada.
- O cidadão não define o status `confirmed`.
- A ocorrência não deve aparecer no mapa público antes da validação humana.

---

## HU02 — Informar descrição textual da ocorrência

**Como cidadão, gostaria de escrever uma descrição da ocorrência, para que o gestor compreenda melhor o contexto do evento.**

### Critérios de aceitação

- Dado que estou registrando uma ocorrência, quando escrevo uma descrição válida, então o sistema deve aceitar o texto.
- Dado que a descrição está vazia, quando tento enviar a ocorrência, então o sistema deve solicitar preenchimento.
- Dado que a descrição é muito curta, então o sistema pode alertar que mais detalhes melhoram a análise.

### Regras de negócio

- A descrição deve ter um tamanho mínimo configurável.
- A descrição deve ser armazenada junto à ocorrência.
- O texto pode ser usado posteriormente para classificação preliminar por NLP.

---

## HU03 — Anexar foto e vídeo da ocorrência

**Como cidadão, gostaria de anexar foto e, opcionalmente, vídeo da ocorrência, para fornecer evidências visuais ao gestor e ao sistema de classificação preliminar.**

**Origem principal:** `FORM + DESIGN + MSL`

### Critérios de aceitação

- Dado que estou registrando uma ocorrência, quando capturo ou seleciono uma foto válida, então o sistema deve anexá-la ao registro.
- Dado que desejo fornecer evidência adicional, então posso anexar vídeo quando o navegador/dispositivo e a versão do protótipo permitirem.
- Dado que o arquivo não é suportado ou excede o limite configurado, então o sistema deve informar o problema sem perder os demais dados preenchidos.
- Dado que não há foto, então o registro pode prosseguir para validação humana, porém a classificação visual deve ficar indisponível.

### Regras de negócio

- Formatos de imagem aceitos no protótipo: `.jpg`, `.jpeg`, `.png` ou `.webp`.
- O sistema deve limitar tamanho e duração de mídia.
- Foto pode ser usada como entrada para Visão Computacional; vídeo pode ser armazenado como evidência complementar.
- Mídia enviada no protótipo não deve ser tratada como prova oficial.

---

## HU04 — Usar localização automática

**Como cidadão, gostaria de permitir que o sistema obtenha minha localização automaticamente, para que eu não precise informar manualmente onde ocorreu o evento.**

### Critérios de aceitação

- Dado que autorizo o acesso à localização, quando registro a ocorrência, então o sistema deve preencher latitude e longitude automaticamente.
- Dado que nego o acesso à localização, então o sistema deve permitir inserir a localização manualmente.
- Dado que a localização foi capturada, então ela deve ser exibida antes do envio para conferência.

### Regras de negócio

- O sistema deve pedir permissão antes de acessar geolocalização.
- A localização automática pode ser aproximada.
- O sistema deve permitir correção manual da localização.

---

## HU05 — Informar localização manualmente

**Como cidadão, gostaria de informar manualmente a localização da ocorrência, para que eu consiga registrar o evento mesmo sem permitir geolocalização automática.**

### Critérios de aceitação

- Dado que a geolocalização automática não está disponível, quando informo região, endereço aproximado ou ponto no mapa, então consigo enviar a ocorrência.
- Dado que não há localização informada, então o sistema deve impedir o envio ou solicitar correção.
- Dado que seleciono um ponto no mapa, então o sistema deve registrar latitude e longitude.

### Regras de negócio

- A localização manual deve ser validada minimamente.
- No protótipo, pode ser aceita seleção de ponto no mapa.
- Registros sem localização não devem ser usados na visualização geográfica.

---

## HU06 — Visualizar pré-análise após registro

**Como cidadão, gostaria de visualizar uma pré-análise compreensível da ocorrência, para saber o que o sistema inferiu e que a decisão ainda depende de validação humana.**

**Origem principal:** `FORM + DESIGN + MSL`

### Critérios de aceitação

- Dado que a classificação preliminar é concluída, então o sistema deve mostrar o tipo provável de desastre.
- Dado que existe pontuação de confiança, então ela deve ser exibida de forma clara.
- Dado que há informações suficientes, então o sistema deve apresentar uma explicação curta em linguagem simples.
- Dado que a ocorrência ainda não foi validada, então o sistema nunca deve exibir “confirmado” como resultado da IA.
- Dado que a análise automática não puder ser executada, então o sistema deve indicar que o registro seguirá para análise humana.

### Regras de negócio

- Utilizar termos como “classificação preliminar”, “pré-análise” e “aguardando validação”.
- Confiança percentual é evidência de apoio, não confirmação.
- XAI visual avançada não é obrigatória no MVP.
- A interface deve informar que o registro será revisado por gestor.

---

## HU07 — Consultar status da ocorrência

**Como cidadão, gostaria de consultar o status da ocorrência que registrei, para que eu saiba se ela foi analisada, confirmada, rejeitada ou se precisa de mais informações.**

### Critérios de aceitação

- Dado que registrei uma ocorrência, quando acesso o acompanhamento, então vejo o status atual.
- Dado que o gestor altera o status, então o cidadão deve visualizar a atualização.
- Dado que a ocorrência precisa de mais informações, então o sistema deve indicar quais dados precisam ser complementados.

### Regras de negócio

- Os status devem seguir a lista oficial definida pelo sistema.
- O cidadão não pode alterar o status administrativo.
- Apenas o gestor ou o sistema de sincronização podem alterar determinados status.

---

## HU08 — Complementar informações solicitadas

**Como cidadão, gostaria de complementar uma ocorrência quando o gestor solicitar mais informações, para que a análise possa ser concluída.**

### Critérios de aceitação

- Dado que minha ocorrência está como `needs_more_info`, quando adiciono informações complementares, então o sistema deve reenviar a ocorrência para análise.
- Dado que envio o complemento, então o status deve voltar para `under_review`.
- Dado que adiciono uma nova imagem ou texto, então o gestor deve visualizar o complemento no histórico.

### Regras de negócio

- O complemento deve ser registrado com data/hora.
- O sistema deve preservar a versão original da ocorrência.
- A ocorrência não deve aparecer publicamente até confirmação.

---

# 6. Épico B — Consulta pública de ocorrências confirmadas

## HU09 — Ver ocorrências próximas confirmadas

**Como cidadão, gostaria de visualizar ocorrências confirmadas próximas à minha localização, para que eu possa me informar sobre riscos ambientais na região.**

### Critérios de aceitação

- Dado que acesso o mapa público, quando há ocorrências confirmadas próximas, então elas devem aparecer no mapa.
- Dado que uma ocorrência ainda está em análise, então ela não deve aparecer no mapa público.
- Dado que autorizo localização, então o sistema pode ordenar ocorrências por proximidade.

### Regras de negócio

- Apenas ocorrências `confirmed` aparecem no mapa público.
- O raio padrão deve ser configurável.
- O sistema deve deixar claro que as informações são de apoio e não substituem órgãos oficiais.

---

## HU10 — Filtrar ocorrências próximas por tipo

**Como cidadão, gostaria de filtrar ocorrências próximas por tipo de desastre, para que eu visualize apenas eventos relevantes para mim.**

### Critérios de aceitação

- Dado que estou no mapa público, quando seleciono “queimadas”, então vejo apenas ocorrências confirmadas desse tipo.
- Dado que seleciono “alagamentos”, então vejo apenas ocorrências confirmadas desse tipo.
- Dado que removo o filtro, então volto a ver todas as ocorrências confirmadas próximas.

### Regras de negócio

- Os filtros públicos devem considerar apenas ocorrências confirmadas.
- No escopo inicial, os tipos principais são `incendio_queimada` e `inundacao_alagamento`.

---

## HU11 — Definir raio de distância

**Como cidadão, gostaria de definir um raio de distância para visualizar ocorrências, para que eu veja apenas eventos próximos da minha região.**

### Critérios de aceitação

- Dado que estou no mapa, quando seleciono um raio, então o sistema deve filtrar ocorrências dentro desse limite.
- Dado que não há ocorrências no raio selecionado, então o sistema deve informar que nenhuma ocorrência foi encontrada.
- Dado que altero o raio, então os pontos do mapa devem ser atualizados.

### Regras de negócio

- O cálculo de distância pode ser aproximado no protótipo.
- O raio padrão deve ser definido pelo sistema.
- Ocorrências sem localização válida não devem entrar nesse filtro.

---

## HU12 — Visualizar detalhes públicos de uma ocorrência confirmada

**Como cidadão, gostaria de abrir uma ocorrência confirmada no mapa, para que eu veja informações básicas sobre o evento.**

### Critérios de aceitação

- Dado que clico em uma ocorrência confirmada, então vejo tipo, urgência, localização aproximada e hora aproximada do relato. A descrição livre do cidadão não aparece no mapa público, porque pode conter dados pessoais.
- Dado que a ocorrência possui imagem, então o sistema pode exibir uma miniatura.
- Dado que a ocorrência foi confirmada, então o sistema deve indicar que houve validação por gestor.

### Regras de negócio

- O sistema não deve expor dados pessoais do cidadão.
- A localização pode ser aproximada para preservar privacidade.
- Informações sensíveis devem ser omitidas no mapa público.

---

# 7. Épico C — Offline-first e sincronização

## HU13 — Registrar ocorrência sem internet

**Como cidadão, gostaria de registrar uma ocorrência mesmo sem internet, para que eu não perca o registro em situações críticas.**

### Critérios de aceitação

- Dado que estou sem conexão, quando registro uma ocorrência, então o sistema deve salvá-la localmente.
- Dado que a ocorrência foi salva localmente, então ela deve receber status `pending_sync`.
- Dado que a conexão retorna, então o sistema deve permitir sincronizar a ocorrência com o servidor.

### Regras de negócio

- Registros offline devem ser armazenados no navegador usando armazenamento local apropriado, como IndexedDB.
- O usuário deve ser informado de que a ocorrência ainda não foi enviada.
- Ocorrências `pending_sync` não aparecem para gestores até sincronização.

---

## HU14 — Sincronizar ocorrências pendentes

**Como sistema de sincronização, gostaria de enviar ocorrências pendentes quando a conexão voltar, para que os gestores recebam registros feitos offline.**

### Critérios de aceitação

- Dado que existem ocorrências `pending_sync`, quando a conexão retorna, então o sistema deve tentar enviá-las.
- Dado que a sincronização é bem-sucedida, então o status deve mudar para `synced` ou `under_review`.
- Dado que a sincronização falha, então o sistema deve manter a ocorrência como pendente e tentar novamente depois.

### Regras de negócio

- A sincronização não deve duplicar ocorrências.
- Cada ocorrência deve possuir identificador local temporário.
- O servidor deve retornar identificador definitivo após sincronização.

---

## HU15 — Visualizar pendências de sincronização

**Como cidadão, gostaria de visualizar quais ocorrências ainda não foram sincronizadas, para que eu saiba se meu registro chegou ao sistema.**

### Critérios de aceitação

- Dado que existem ocorrências pendentes, então o app deve mostrar uma indicação visual.
- Dado que uma ocorrência foi sincronizada, então ela deve sair da lista de pendências.
- Dado que há erro de sincronização, então o sistema deve exibir mensagem compreensível.

### Regras de negócio

- O sistema deve diferenciar ocorrência salva localmente de ocorrência enviada ao servidor.
- O cidadão deve poder tentar sincronizar manualmente, se a sincronização automática falhar.

---

# 8. Épico D — Dashboard do gestor

## HU16 — Visualizar mapa de ocorrências

**Como gestor ambiental, gostaria de visualizar ocorrências em um mapa interativo e atualizado, para identificar distribuição espacial, concentração e prioridade operacional dos eventos.**

**Origem principal:** `FORM + DESIGN`

### Critérios de aceitação

- Dado que acesso o dashboard, quando há ocorrências georreferenciadas, então elas devem aparecer no mapa.
- Dado que clico em um marcador, então vejo resumo com tipo, status, urgência, data/hora e confiança quando disponível.
- Dado que aplico filtros, então mapa e lista devem refletir o mesmo conjunto de ocorrências.
- Dado que uma ocorrência não possui localização válida, então ela deve permanecer acessível em lista e ser sinalizada como não mapeável.

### Regras de negócio

- Marcadores devem diferenciar tipo e status.
- Mapa em tempo real/atualizado é uma das principais telas do sistema.
- O mapa do gestor pode mostrar registros em análise, confirmados e rejeitados conforme permissões e filtros.
- Atualização em tempo real pode ser aproximada no protótipo, desde que o horário da última atualização esteja disponível.

---

## HU17 — Listar ocorrências recentes

**Como gestor ambiental, gostaria de visualizar uma lista de ocorrências recentes, para que eu consiga priorizar análises.**

### Critérios de aceitação

- Dado que acesso o dashboard, então vejo as ocorrências mais recentes.
- Dado que há muitas ocorrências, então a lista deve permitir paginação, ordenação ou limite de exibição.
- Dado que uma ocorrência tem alto nível de confiança ou risco, então ela pode ser destacada visualmente.

### Regras de negócio

- A ordenação padrão deve priorizar ocorrências recentes.
- Ocorrências de alto risco podem receber destaque.
- A lista deve mostrar status, tipo, data/hora, região e confiança.

---

## HU18 — Filtrar ocorrências por tipo de desastre

**Como gestor ambiental, gostaria de filtrar ocorrências por tipo de desastre, para analisar separadamente categorias relevantes e reduzir o volume de informação exibida.**

**Origem principal:** `FORM + DESIGN`

### Critérios de aceitação

- Dado que seleciono `incendio_queimada`, então mapa e lista mostram apenas ocorrências desse tipo.
- Dado que seleciono `inundacao_alagamento`, então mapa e lista mostram apenas ocorrências desse tipo.
- Dado que seleciono “todos”, então o filtro por tipo é removido.
- Dado que novas categorias forem habilitadas, então elas devem aparecer automaticamente no conjunto de filtros permitido.

### Regras de negócio

- Filtro por tipo é obrigatório no dashboard.
- Tipos devem utilizar categorias compatíveis com a estrutura COBRADE adotada pelo projeto.
- O escopo inicial ativa queimadas/incêndios e alagamentos/inundações, sem impedir expansão futura.

---

## HU19 — Filtrar ocorrências por status

**Como gestor ambiental, gostaria de filtrar ocorrências por status, para que eu priorize registros pendentes de análise.**

### Critérios de aceitação

- Dado que seleciono `under_review`, então vejo apenas ocorrências em análise.
- Dado que seleciono `confirmed`, então vejo apenas ocorrências confirmadas.
- Dado que seleciono `rejected`, então vejo apenas ocorrências rejeitadas.
- Dado que removo o filtro, então vejo todas as ocorrências.

### Regras de negócio

- O filtro por status deve estar disponível no dashboard.
- Ocorrências `pending_sync` não aparecem no dashboard enquanto não forem enviadas ao servidor.
- Ocorrências rejeitadas devem continuar disponíveis para auditoria interna.

---

## HU20 — Filtrar ocorrências por nível de confiança

**Como gestor ambiental, gostaria de filtrar ocorrências por confiança da classificação preliminar, para priorizar casos de alta confiança ou revisar casos incertos.**

**Origem principal:** `FORM + DESIGN`

### Critérios de aceitação

- Dado que seleciono uma faixa de confiança, então mapa e lista mostram apenas registros compatíveis.
- Dado que uma ocorrência não possui confiança automática, então ela deve ser identificada como “sem avaliação automática”.
- Dado que altero o tipo de desastre, então o sistema pode utilizar faixas/limiares específicos para aquela categoria.
- Dado que a confiança é baixa, então a ocorrência deve continuar disponível para análise humana.

### Regras de negócio

- Não adotar 70% como limiar universal obrigatório.
- Limiares devem ser configuráveis e podem variar por tipo de desastre.
- Confiança não equivale a confirmação.
- Baixa confiança pode aumentar prioridade de revisão em vez de causar rejeição automática.

---

## HU21 — Abrir detalhes de uma ocorrência

**Como gestor ambiental, gostaria de abrir os detalhes de uma ocorrência, para que eu analise imagem, texto, localização, classificação e histórico antes de tomar decisão.**

### Critérios de aceitação

- Dado que clico em uma ocorrência, então o sistema abre uma tela de detalhes.
- Dado que a ocorrência possui imagem, então ela deve ser exibida.
- Dado que há classificação preliminar, então o sistema deve mostrar tipo previsto e confiança.
- Dado que há histórico de status, então ele deve ser exibido ou estar acessível.

### Regras de negócio

- A tela de detalhes deve diferenciar classificação da IA e validação humana.
- O gestor deve conseguir tomar decisão a partir dessa tela.
- Alterações devem ser registradas no histórico.

---

## HU22 — Confirmar ocorrência

**Como gestor ambiental, gostaria de confirmar uma ocorrência, para que ela seja considerada validada e possa aparecer no mapa público.**

### Critérios de aceitação

- Dado que estou nos detalhes da ocorrência, quando clico em “confirmar”, então o status muda para `confirmed`.
- Dado que uma ocorrência é confirmada, então ela passa a aparecer no mapa público.
- Dado que o gestor confirma, então o sistema registra data/hora e responsável pela decisão.

### Regras de negócio

- Apenas gestores autorizados podem confirmar ocorrências.
- A confirmação humana prevalece sobre a classificação preliminar da IA.
- Ocorrências confirmadas devem alimentar indicadores do painel analítico.

---

## HU23 — Rejeitar ocorrência

**Como gestor ambiental, gostaria de rejeitar uma ocorrência, para que registros inválidos não apareçam publicamente nem influenciem análises indevidas.**

### Critérios de aceitação

- Dado que estou nos detalhes da ocorrência, quando clico em “rejeitar”, então o status muda para `rejected`.
- Dado que rejeito uma ocorrência, então ela não deve aparecer no mapa público.
- Dado que rejeito, então o sistema deve permitir registrar motivo da rejeição.

### Regras de negócio

- Ocorrências rejeitadas devem permanecer no banco para auditoria.
- O motivo da rejeição pode ser obrigatório.
- Ocorrências rejeitadas não devem alimentar estatísticas públicas como eventos confirmados.

---

## HU24 — Solicitar mais informações

**Como gestor ambiental, gostaria de solicitar mais informações ao cidadão, para que ocorrências incompletas possam ser avaliadas com maior segurança.**

### Critérios de aceitação

- Dado que uma ocorrência está incompleta, quando solicito mais informações, então o status muda para `needs_more_info`.
- Dado que solicito complemento, então devo informar o que falta.
- Dado que o cidadão complementa, então a ocorrência retorna para `under_review`.

### Regras de negócio

- O pedido de complemento deve ser registrado no histórico.
- A ocorrência não deve aparecer publicamente enquanto aguarda complemento.
- O cidadão deve visualizar a solicitação no app.

---

## HU25 — Alterar classificação confirmada

**Como gestor ambiental, gostaria de corrigir o tipo de desastre sugerido pela IA, para que a ocorrência seja classificada corretamente antes de ser confirmada.**

### Critérios de aceitação

- Dado que a IA classificou como queimada, quando identifico que é alagamento, então posso alterar a categoria.
- Dado que altero a categoria, então o sistema deve armazenar a classificação original e a classificação confirmada.
- Dado que confirmo a ocorrência, então a categoria confirmada deve prevalecer nas visualizações públicas.

### Regras de negócio

- O sistema deve manter `predicted_disaster_type` e `confirmed_disaster_type`.
- A classificação humana prevalece em relatórios operacionais.
- A classificação preliminar pode ser usada para análise de desempenho da IA.

---

# 9. Épico E — Painel analítico

## HU26 — Visualizar total de ocorrências

**Como gestor ambiental, gostaria de visualizar o total de ocorrências registradas, para que eu acompanhe o volume geral de eventos monitorados.**

### Critérios de aceitação

- Dado que acesso o painel analítico, então vejo o total de ocorrências.
- Dado que aplico filtros, então o total deve ser atualizado.
- Dado que há diferença entre ocorrências registradas e confirmadas, então o sistema deve indicar isso claramente.

### Regras de negócio

- O painel deve diferenciar total registrado, total confirmado, em análise e rejeitado.
- Indicadores devem ser calculados com base nos filtros ativos.

---

## HU27 — Visualizar ocorrências por tipo

**Como gestor ambiental, gostaria de visualizar a distribuição de ocorrências por tipo de desastre, para que eu identifique quais eventos são mais frequentes.**

### Critérios de aceitação

- Dado que há ocorrências registradas, então o sistema deve mostrar contagem por tipo.
- Dado que há ocorrências confirmadas e não confirmadas, então o painel pode permitir alternar entre ambas.
- Dado que aplico filtro por período, então a distribuição deve ser recalculada.

### Regras de negócio

- Relatórios públicos devem considerar apenas ocorrências confirmadas.
- Relatórios internos podem incluir registros em análise.
- Categorias futuras devem ser compatíveis com a estrutura atual.

---

## HU28 — Visualizar ocorrências por período

**Como gestor ambiental, gostaria de visualizar ocorrências ao longo do tempo, para que eu identifique tendências e sazonalidades.**

### Critérios de aceitação

- Dado que acesso o gráfico temporal, então vejo ocorrências por dia, semana ou mês.
- Dado que aplico filtro de tipo, então o gráfico deve exibir apenas aquele tipo.
- Dado que não há dados no período, então o sistema deve exibir estado vazio.

### Regras de negócio

- A data considerada deve ser a data de registro da ocorrência.
- O sistema pode permitir granularidade diária, semanal ou mensal.
- Dados sintéticos devem ser identificados como tal quando usados no protótipo.

---

## HU29 — Visualizar ocorrências por região

**Como gestor ambiental, gostaria de visualizar ocorrências por região, para que eu identifique áreas com maior concentração de eventos.**

### Critérios de aceitação

- Dado que há ocorrências com região definida, então o sistema deve mostrar ranking ou gráfico por região.
- Dado que filtro por tipo de desastre, então o ranking deve ser atualizado.
- Dado que uma ocorrência não possui região, então ela pode ser agrupada como “região não informada”.

### Regras de negócio

- A região pode ser derivada da localização ou informada manualmente.
- O protótipo pode usar regiões sintéticas.
- Regiões com maior concentração podem ser destacadas.

---

## HU30 — Visualizar taxa de confirmação

**Como gestor ambiental, gostaria de visualizar a taxa de confirmação das ocorrências, para que eu avalie a qualidade dos registros e da triagem preliminar.**

### Critérios de aceitação

- Dado que existem ocorrências analisadas, então o sistema calcula percentual confirmado.
- Dado que há ocorrências rejeitadas, então elas devem ser consideradas no cálculo.
- Dado que não há ocorrências analisadas, então o sistema deve evitar divisão por zero e exibir mensagem adequada.

### Regras de negócio

- Taxa de confirmação = confirmadas / total analisado.
- Ocorrências `under_review` podem ser excluídas do denominador.
- Essa métrica não deve ser confundida com acurácia da IA.

---

## HU31 — Visualizar confiança média da IA

**Como gestor ambiental, gostaria de visualizar a confiança média das classificações preliminares, para que eu acompanhe a consistência das sugestões automáticas.**

### Critérios de aceitação

- Dado que há ocorrências com confiança calculada, então o sistema mostra média de confiança.
- Dado que filtro por tipo, então a média deve ser recalculada.
- Dado que uma ocorrência não possui confiança, então ela deve ser excluída do cálculo ou marcada como sem avaliação.

### Regras de negócio

- Confiança média não equivale a desempenho real.
- O desempenho real depende da comparação com validação humana.
- O sistema deve evitar interpretações enganosas dessa métrica.

---

# 10. Épico F — Previsão de risco com Machine Learning

## HU32 — Consultar previsão de risco por região

**Como gestor ambiental, gostaria de consultar risco previsto por região e horizonte temporal, para priorizar áreas que merecem monitoramento preventivo.**

**Origem principal:** `FORM + MSL + DESIGN`

### Critérios de aceitação

- Dado que seleciono uma região, então o sistema deve retornar risco baixo, médio/moderado ou alto.
- Dado que o modelo retorna probabilidade, então o sistema pode exibi-la junto ao nível de risco.
- Dado que seleciono horizonte de previsão, então o protótipo deve priorizar 24–48 h e pode disponibilizar 7 dias como opção complementar.
- Dado que existe histórico disponível, então o sistema pode apresentar comparação com períodos/eventos anteriores.
- Dado que os dados são sintéticos, então a tela deve indicar explicitamente o caráter experimental da estimativa.

### Regras de negócio

- Previsão é apoio à decisão, não alerta oficial.
- O nível baixo/médio/alto deve ser a representação principal.
- Horizonte de 24–48 h é prioritário no protótipo.
- O modelo e os dados utilizados devem ser identificáveis para auditoria e reprodução.

---

## HU33 — Consultar previsão por tipo de desastre

**Como gestor ambiental, gostaria de consultar risco por tipo de desastre, para que eu diferencie risco de queimada e risco de alagamento.**

### Critérios de aceitação

- Dado que seleciono `incendio_queimada`, então o sistema calcula risco considerando variáveis relacionadas a queimadas.
- Dado que seleciono `inundacao_alagamento`, então o sistema calcula risco considerando variáveis relacionadas a chuva e drenagem.
- Dado que seleciono todos os tipos, então o sistema pode mostrar visão comparativa.

### Regras de negócio

- Cada tipo de desastre pode ter variáveis mais relevantes.
- O mesmo modelo pode ser multiclasse ou podem existir modelos separados por tipo.
- No protótipo, a abordagem deve ser documentada.

---

## HU34 — Exibir fatores e contexto utilizados na previsão

**Como gestor ambiental, gostaria de visualizar os dados e fatores que sustentam uma previsão, para compreender a origem da estimativa e avaliar sua coerência.**

**Origem principal:** `FORM + MSL`

### Critérios de aceitação

- Dado que abro uma previsão, então o sistema deve indicar as principais entradas utilizadas.
- Dado que uma variável obrigatória esteja ausente ou desatualizada, então isso deve ser sinalizado.
- Dado que há histórico comparável, então a interface pode mostrar referência temporal ou eventos similares.
- Dado que o risco é alto, então os fatores críticos devem ser resumidos de forma compreensível.

### Regras de negócio

- Esta história exige transparência de entradas e não implica XAI avançada.
- Valores, origem e instante de atualização dos dados devem ser rastreáveis quando disponíveis.
- SHAP e outras técnicas de explicabilidade avançada ficam em evolução específica.

---

## HU35 — Comparar Random Forest e XGBoost

**Como pesquisador, gostaria de comparar Random Forest e XGBoost, para que eu escolha o modelo mais adequado ao protótipo.**

### Critérios de aceitação

- Dado que os dois modelos foram treinados, então o sistema ou relatório deve apresentar métricas comparativas.
- Dado que há diferença de desempenho, então a escolha deve ser justificada.
- Dado que o XGBoost exige mais ajuste, então Random Forest pode ser mantido como baseline.

### Regras de negócio

- Métricas mínimas: acurácia, precisão, recall, F1-score e matriz de confusão.
- O recall da classe `alto` deve ter peso interpretativo maior.
- A comparação deve deixar claro que a base é sintética.

---

## HU36 — Servir modelo treinado via API

**Como sistema de IA, gostaria de disponibilizar o modelo treinado por meio de uma API, para que o dashboard consiga solicitar previsões de risco.**

### Critérios de aceitação

- Dado que a API recebe variáveis válidas, então retorna nível de risco.
- Dado que faltam variáveis obrigatórias, então retorna erro de validação.
- Dado que o modelo está indisponível, então a API deve retornar erro controlado.

### Regras de negócio

- O modelo deve ser versionado ou identificado.
- O endpoint deve validar os dados de entrada.
- O sistema deve registrar previsões realizadas, se necessário para auditoria.

---

# 11. Épico G — Classificação preliminar por imagem e texto

## HU37 — Classificar imagem da ocorrência

**Como sistema de IA, gostaria de classificar a imagem enviada pelo cidadão, para que o sistema sugira preliminarmente o tipo de desastre.**

### Critérios de aceitação

- Dado que uma imagem válida é enviada, então o sistema deve retornar uma categoria provável.
- Dado que a imagem é ambígua, então o sistema deve retornar baixa confiança ou categoria “outro”.
- Dado que a classificação foi feita, então o resultado deve ser salvo na ocorrência.

### Regras de negócio

- No PIBIC, o uso deve ser baseado em modelo pré-treinado, fine-tuning leve ou simulação controlada.
- O sistema não deve afirmar que a classificação visual é definitiva.
- Categorias iniciais: queimadas/incêndios e alagamentos/inundações.

---

## HU38 — Classificar texto da ocorrência

**Como sistema de IA, gostaria de analisar a descrição textual enviada pelo cidadão, para que o sistema sugira uma categoria preliminar para a ocorrência.**

### Critérios de aceitação

- Dado que a descrição contém termos associados a fogo ou fumaça, então o sistema pode sugerir queimada.
- Dado que a descrição contém termos associados a chuva, água ou alagamento, então o sistema pode sugerir inundação/alagamento.
- Dado que o texto é insuficiente, então o sistema deve retornar baixa confiança ou solicitar mais informações.

### Regras de negócio

- A abordagem inicial pode usar regras, modelo pré-treinado ou classificador simples.
- NLP robusto fica fora do escopo inicial.
- O resultado textual pode ser combinado com imagem e metadados.

---

## HU39 — Combinar imagem, texto e metadados

**Como sistema de IA, gostaria de combinar imagem, texto e metadados da ocorrência, para que a classificação preliminar seja mais robusta.**

### Critérios de aceitação

- Dado que imagem e texto concordam, então a confiança final pode ser maior.
- Dado que imagem e texto discordam, então a ocorrência deve ser marcada para revisão cuidadosa.
- Dado que há localização e contexto temporal, então esses dados podem ser usados como apoio.

### Regras de negócio

- A lógica de combinação deve ser simples e documentada.
- A decisão final continua sendo do gestor.
- O sistema deve armazenar os sinais usados na classificação.

---

## HU40 — Marcar ocorrência como ambígua

**Como sistema de IA, gostaria de marcar ocorrências ambíguas, para que gestores saibam que a classificação automática não é confiável.**

### Critérios de aceitação

- Dado que a confiança fica abaixo do limiar, então a ocorrência deve ser marcada como baixa confiança.
- Dado que imagem e texto divergem, então o sistema pode indicar ambiguidade.
- Dado que a ocorrência é ambígua, então ela deve continuar disponível para análise humana.

### Regras de negócio

- Baixa confiança não implica rejeição automática.
- O limiar de confiança deve ser configurável.
- Ocorrências ambíguas devem ser priorizadas ou destacadas conforme decisão de projeto.

---

# 12. Épico H — Administração e configuração

## HU41 — Gerenciar usuários gestores

**Como administrador, gostaria de gerenciar usuários gestores, para que apenas pessoas autorizadas possam validar ocorrências.**

### Critérios de aceitação

- Dado que sou administrador, posso criar, editar ou desativar gestores.
- Dado que um usuário não é gestor, então ele não pode confirmar ou rejeitar ocorrências.
- Dado que um gestor é desativado, então ele perde acesso ao dashboard.

### Regras de negócio

- Controle de autenticação pode ser simplificado no protótipo.
- Operações administrativas devem ser registradas quando possível.
- O papel do usuário determina suas permissões.

---

## HU42 — Configurar categorias de desastre

**Como administrador, gostaria de configurar categorias de desastre, para que o sistema possa ser expandido no futuro.**

### Critérios de aceitação

- Dado que sou administrador, posso visualizar categorias disponíveis.
- Dado que uma nova categoria é adicionada, então ela pode aparecer nos filtros.
- Dado que uma categoria está desativada, então ela não deve aparecer no registro público.

### Regras de negócio

- No escopo inicial, apenas duas categorias devem estar ativas.
- Categorias futuras devem seguir classificação compatível com o projeto.
- Alterar categorias não deve quebrar ocorrências antigas.

---

## HU43 — Configurar limiares de confiança

**Como administrador/pesquisador, gostaria de configurar limiares de confiança por contexto ou tipo de desastre, para que o protótipo possa testar regras de triagem sem assumir um valor universal.**

**Origem principal:** `FORM + MSL`

### Critérios de aceitação

- Dado que acesso a configuração, então posso definir faixas de baixa, média e alta confiança.
- Dado que existem categorias distintas, então o sistema pode permitir limiares específicos por tipo de desastre.
- Dado que um limiar é alterado, então a nova regra deve ser registrada e aplicada apenas às avaliações subsequentes, salvo reprocessamento explícito.

### Regras de negócio

- Não há evidência suficiente para impor 70% como limiar global.
- O limiar nunca deve confirmar uma ocorrência automaticamente.
- Configurações devem ser versionadas/documentadas para garantir reprodutibilidade.

---

# 13. Épico I — Auditoria, histórico e rastreabilidade

## HU44 — Registrar histórico de status

**Como gestor ambiental, gostaria que o sistema registrasse o histórico de mudanças de status, para que seja possível auditar decisões tomadas.**

### Critérios de aceitação

- Dado que uma ocorrência muda de status, então o sistema registra status anterior, novo status, data/hora e usuário responsável.
- Dado que abro os detalhes da ocorrência, então posso visualizar o histórico.
- Dado que a mudança foi automática, então o sistema deve registrar o agente como sistema.

### Regras de negócio

- Toda mudança de status deve ser rastreável.
- O histórico não deve ser alterado pelo cidadão.
- Exclusões devem ser controladas pelo administrador.

---

## HU45 — Registrar resultado da classificação preliminar

**Como pesquisador, gostaria que o sistema registrasse a classificação preliminar da IA, para que seja possível comparar a sugestão automática com a validação humana.**

### Critérios de aceitação

- Dado que a IA classifica uma ocorrência, então o sistema salva categoria prevista e confiança.
- Dado que o gestor altera a categoria, então o sistema mantém a previsão original.
- Dado que exporto dados para análise, então consigo comparar previsão e confirmação.

### Regras de negócio

- O sistema deve separar `predicted_disaster_type` de `confirmed_disaster_type`.
- Esse registro pode apoiar avaliação futura do modelo.
- No protótipo, os resultados devem ser interpretados com cautela por usarem dados sintéticos/simulados.

---

## HU46 — Exportar dados para análise

**Como pesquisador, gostaria de exportar dados de ocorrências e previsões, para que eu possa analisar resultados e documentar o protótipo no relatório.**

### Critérios de aceitação

- Dado que solicito exportação, então o sistema gera arquivo CSV ou JSON.
- Dado que aplico filtros, então posso exportar apenas dados filtrados.
- Dado que existem dados sensíveis, então eles devem ser omitidos ou anonimizados.

### Regras de negócio

- O protótipo pode exportar dados sintéticos sem dados pessoais.
- Exportações devem diferenciar ocorrências confirmadas e não confirmadas.
- Dados exportados devem preservar campos úteis para análise científica.

---

# 14. Épico J — Segurança, privacidade e ética

## HU47 — Omitir dados pessoais no mapa público

**Como cidadão, gostaria que meus dados pessoais não fossem exibidos no mapa público, para que minha privacidade seja preservada.**

### Critérios de aceitação

- Dado que minha ocorrência é confirmada, então o mapa público não deve mostrar meu nome ou identificador pessoal.
- Dado que a ocorrência possui localização, então o sistema pode exibir localização aproximada.
- Dado que outros usuários visualizam a ocorrência, então eles só veem informações necessárias sobre o evento.

### Regras de negócio

- Dados pessoais não devem ser exibidos publicamente.
- Localização pode ser generalizada.
- Imagens devem ser avaliadas com cautela se contiverem pessoas, placas ou informações sensíveis.

---

## HU48 — Informar caráter experimental do sistema

**Como cidadão ou gestor, gostaria de ser informado de que o sistema é um protótipo experimental, para que eu não confunda suas previsões com alertas oficiais.**

### Critérios de aceitação

- Dado que acesso a previsão de risco, então o sistema deve indicar que se trata de estimativa experimental.
- Dado que vejo a classificação da IA, então o sistema deve indicar que ela é preliminar.
- Dado que uma ocorrência é exibida publicamente, então o sistema deve indicar se foi confirmada por gestor.

### Regras de negócio

- O protótipo não substitui órgãos oficiais.
- Previsões baseadas em dados sintéticos não devem ser tratadas como evidência operacional.
- Mensagens devem evitar linguagem alarmista.

---

## HU49 — Controlar acesso ao dashboard

**Como gestor ambiental, gostaria que o dashboard fosse acessível apenas a usuários autorizados, para que decisões de validação não sejam feitas por pessoas indevidas.**

### Critérios de aceitação

- Dado que não estou autenticado, então não consigo acessar o dashboard.
- Dado que estou autenticado como gestor, então consigo visualizar e validar ocorrências.
- Dado que sou cidadão, então não consigo acessar funções administrativas.

### Regras de negócio

- Autenticação pode ser simples no protótipo.
- Autorização deve separar cidadão, gestor e administrador.
- Ações críticas devem exigir permissão de gestor ou administrador.

---

# 15. Épico K — Interface e usabilidade

## HU50 — Visualizar mensagens claras de erro

**Como usuário, gostaria de receber mensagens claras quando algo der errado, para que eu saiba como corrigir o problema.**

### Critérios de aceitação

- Dado que tento enviar ocorrência sem descrição, então o sistema informa o campo obrigatório.
- Dado que a conexão falha, então o sistema informa que a ocorrência foi salva localmente ou que o envio falhou.
- Dado que o arquivo de imagem é inválido, então o sistema explica o motivo.

### Regras de negócio

- Mensagens devem ser diretas e compreensíveis.
- Erros técnicos não devem ser expostos ao usuário final.
- O sistema deve sugerir ação corretiva quando possível.

---

## HU51 — Usar interface responsiva

**Como cidadão, gostaria de usar o sistema em celular, tablet ou computador, para que eu consiga registrar ocorrências em diferentes dispositivos.**

### Critérios de aceitação

- Dado que acesso pelo celular, então a interface deve se adaptar à tela pequena.
- Dado que acesso pelo computador, então o layout deve aproveitar melhor o espaço.
- Dado que uso o mapa, então controles essenciais devem permanecer acessíveis.

### Regras de negócio

- O app cidadão deve ser priorizado para telas móveis.
- O dashboard gestor pode ser priorizado para desktop.
- A versão web responsiva substitui o app mobile nativo nesta fase.

---

## HU52 — Exibir estado vazio quando não houver dados

**Como usuário, gostaria de ver mensagens adequadas quando não houver ocorrências ou previsões, para que eu entenda que não é erro do sistema.**

### Critérios de aceitação

- Dado que não há ocorrências no mapa, então o sistema mostra mensagem de estado vazio.
- Dado que filtros não retornam resultados, então o sistema informa que nenhum item foi encontrado.
- Dado que não há dados suficientes para previsão, então o sistema informa a limitação.

### Regras de negócio

- Estados vazios devem ser tratados em todas as telas principais.
- O sistema não deve mostrar gráficos vazios sem explicação.
- Dados sintéticos podem ser carregados para demonstração.

---

# 16. Épico L — Qualidade e validação do protótipo

## HU53 — Validar fluxo completo da ocorrência

**Como pesquisador, gostaria de testar o fluxo completo da ocorrência, para que eu comprove que o protótipo funciona de ponta a ponta.**

### Critérios de aceitação

- Dado que um cidadão registra uma ocorrência, então ela chega ao dashboard do gestor.
- Dado que o gestor confirma a ocorrência, então ela aparece no mapa público.
- Dado que o gestor rejeita a ocorrência, então ela não aparece publicamente.
- Dado que a ocorrência fica offline, então ela sincroniza posteriormente.

### Regras de negócio

- Esse fluxo é a prioridade máxima do MVP.
- Telas secundárias só devem avançar depois que esse fluxo estiver funcionando.
- O relatório deve documentar esse fluxo com diagrama ou sequência textual.

---

## HU54 — Avaliar desempenho dos modelos

**Como pesquisador, gostaria de avaliar o desempenho dos modelos de previsão e classificação, para documentar limites, riscos e comparação com baselines no relatório científico.**

**Origem principal:** `MSL`

### Critérios de aceitação

- Dado que um modelo é treinado ou avaliado, então devem ser geradas métricas adequadas à tarefa.
- Dado que há classes desbalanceadas, então métricas por classe devem ser analisadas.
- Dado que a omissão de uma classe crítica possui alto custo, então recall deve ser explicitamente reportado.
- Dado que o modelo é de classificação, então devem ser apresentados pelo menos precisão, recall, F1-score e matriz de confusão.
- Dado que a tarefa envolve segmentação/delimitação espacial, então IoU ou métrica equivalente deve ser considerada.
- Dado que diferentes limiares são relevantes, AUC-ROC pode ser utilizada como complemento quando apropriado.

### Regras de negócio

- Acurácia isolada não é suficiente.
- A avaliação deve deixar claro quando os dados são sintéticos.
- Modelos devem ser comparados com baseline.
- Scripts, sementes, versão do modelo e parâmetros relevantes devem ser preservados para reprodução.

---

## HU55 — Documentar limitações do protótipo

**Como pesquisador, gostaria de documentar as limitações do protótipo, para que o trabalho seja apresentado com rigor acadêmico.**

### Critérios de aceitação

- Dado que o relatório descreve o protótipo, então deve listar o que entra e o que não entra no escopo.
- Dado que são usados dados sintéticos, então essa limitação deve ser explicitada.
- Dado que CV/NLP usa modelos pré-treinados ou simulação, então isso deve ser informado.

### Regras de negócio

- O sistema não deve ser apresentado como pronto para operação real.
- Limitações devem ser tratadas como parte do rigor metodológico.
- Trabalhos futuros devem incluir dados reais, XAI, validação em campo e integração institucional.

---

# 17. Épico M — Filtros, integração e proveniência

## HU56 — Filtrar ocorrências por data/período

**Como gestor ambiental, gostaria de filtrar ocorrências por data ou intervalo de tempo, para analisar eventos recentes e reduzir a quantidade de registros exibidos.**

**Origem principal:** `FORM + DESIGN`

### Critérios de aceitação

- Dado que seleciono um intervalo, então mapa, lista e indicadores devem considerar o mesmo período.
- Dado que limpo o filtro, então o período volta ao padrão do dashboard.
- Dado que não há registros no período, então o sistema deve apresentar estado vazio.

### Regras de negócio

- Data/período é filtro prioritário.
- O período deve considerar data/hora do registro, salvo indicador que documente outro campo temporal.

---

## HU57 — Integrar fontes externas de dados ambientais

**Como gestor/pesquisador, gostaria de integrar fontes históricas, meteorológicas, hidrológicas e satelitais, para enriquecer monitoramento e previsão sem depender de uma única origem.**

**Origem principal:** `FORM + MSL`

### Critérios de aceitação

- Dado que uma fonte está habilitada, então o sistema deve conseguir consumir ou importar dados no formato definido.
- Dado que a fonte está indisponível, então o sistema deve registrar a falha sem bloquear todo o dashboard.
- Dado que dados externos são exibidos ou usados em previsão, então a origem deve ser identificável.

### Regras de negócio

- Prioridades de integração apontadas no levantamento: dados socioambientais, INPE e chuvas/níveis de rio; histórico de ocorrências e estações meteorológicas também são relevantes.
- Integração oficial com órgãos externos não é obrigatória no MVP.
- O protótipo pode usar adaptadores, arquivos controlados ou APIs públicas para demonstrar a arquitetura.

---

## HU58 — Registrar proveniência dos dados e inferências

**Como pesquisador/gestor, gostaria de saber de onde vieram os dados usados em uma ocorrência ou previsão, para garantir rastreabilidade e interpretar corretamente os resultados.**

**Origem principal:** `MSL`

### Critérios de aceitação

- Dado que um dado externo é utilizado, então devem ser registrados fonte e instante de obtenção/atualização quando disponíveis.
- Dado que uma inferência é produzida, então devem ser identificáveis versão do modelo e principais entradas.
- Dado que um dado é sintético, então essa condição deve ser explicitada.

### Regras de negócio

- Proveniência deve ser preservada para auditoria e reprodução.
- Dados de cidadão e dados externos devem ser distinguíveis.
- Informações internas de proveniência não precisam ser expostas integralmente no mapa público.

---

## HU59 — Detectar ou limitar registros duplicados e spam

**Como gestor ambiental, gostaria que o sistema sinalizasse possíveis duplicidades ou abuso, para reduzir ruído sem eliminar registros legítimos automaticamente.**

**Origem principal:** `FORM`

### Critérios de aceitação

- Dado que registros muito semelhantes surgem em curto período e região próxima, então o sistema pode sinalizar possível duplicidade.
- Dado que um usuário envia volume anormal de registros, então o sistema pode aplicar limitação configurável.
- Dado que um registro é sinalizado, então ele continua disponível para auditoria e validação humana.

### Regras de negócio

- O sistema não deve excluir automaticamente uma ocorrência apenas por similaridade.
- Regras anti-spam devem ser transparentes para administradores.
- Controles de abuso não devem impedir uso legítimo em eventos de grande escala.

---

# 18. Épico N — Transparência, explicabilidade e acesso

## HU60 — Exibir explicação em linguagem simples

**Como gestor/cidadão, gostaria de receber uma explicação curta e compreensível junto à classificação ou previsão, para interpretar o resultado sem depender de conhecimento técnico de IA.**

**Origem principal:** `FORM + MSL`

### Critérios de aceitação

- Dado que uma classificação/previsão é exibida, então deve haver texto curto explicando seu caráter preliminar.
- Dado que há fatores de entrada disponíveis, então a explicação pode mencionar os fatores mais relevantes de forma não técnica.
- Dado que existe uma visão técnica, então a interface pode permitir alternar entre versão simples e detalhada.

### Regras de negócio

- A versão simples deve ser priorizada para gestores.
- Explicação não deve criar aparência de certeza absoluta.
- O sistema deve diferenciar explicação de entrada/resultado de explicabilidade matemática avançada.

---

## HU61 — Exibir evidência visual da classificação por imagem

**Como gestor ambiental, gostaria de visualizar evidência visual da classificação por imagem, para verificar onde o modelo concentrou sua atenção.**

**Origem principal:** `FORM + MSL`  
**Fase:** evolução pós-MVP / XAI

### Critérios de aceitação

- Dado que um método como Grad-CAM esteja disponível, então a tela de detalhes pode exibir o mapa de ativação associado à imagem.
- Dado que a evidência visual não possa ser calculada, então a ausência não deve impedir a validação manual.
- Dado que a evidência seja exibida, então deve haver aviso de que ela auxilia interpretação e não prova causalidade.

### Regras de negócio

- A evidência visual não confirma ocorrência.
- Grad-CAM/SHAP e técnicas equivalentes devem ser tratadas como componentes experimentais.
- Esta história possui alta demanda no levantamento, mas é adiada por custo/escopo técnico.

---

## HU62 — Cadastrar ou autenticar cidadão de forma compatível com o protótipo

**Como cidadão, gostaria de possuir uma forma simples de identificação no sistema, para acompanhar meus registros sem expor mais dados pessoais do que o necessário.**

**Origem principal:** `FORM + DESIGN`

### Critérios de aceitação

- Dado que o protótipo exige identificação, então o cadastro deve solicitar somente os dados necessários.
- Dado que o usuário já está autenticado, então deve conseguir consultar seus registros e respectivos status.
- Dado que o projeto adote login simplificado, então telefone/e-mail ou mecanismo equivalente pode ser utilizado conforme decisão de implementação.

### Regras de negócio

- O levantamento apresentou maior frequência para cadastro obrigatório, mas não consenso absoluto; por isso o mecanismo pode ser simplificado no protótipo.
- Dados de identificação nunca devem aparecer no mapa público.
- Autenticação do cidadão e autorização do gestor possuem níveis de privilégio distintos.

---

# 19. Priorização consolidada

A prioridade de implementação não é determinada apenas pela frequência do formulário. Ela combina evidência empírica, relevância do MSL, dependências do fluxo e custo técnico.

## P0 — Essencial para validar o fluxo e uso em campo

| Código | História | Fundamentação principal |
|---|---|---|
| HU01 | Registrar ocorrência ambiental | fluxo central + campos priorizados no formulário |
| HU03 | Anexar foto e vídeo | foto 12/13; vídeo 9/13 |
| HU04 | Usar localização automática | GPS 11/13 |
| HU05 | Informar localização manualmente | fallback operacional |
| HU09 | Ver ocorrências próximas confirmadas | consulta pública com política conservadora |
| HU13 | Registrar ocorrência sem internet | conectividade limitada 13/13 entre “sim” e “às vezes” |
| HU14 | Sincronizar ocorrências pendentes | dependência direta do offline-first |
| HU15 | Visualizar pendências de sincronização | transparência operacional |
| HU16 | Visualizar mapa de ocorrências | mapa 12/13 |
| HU17 | Listar ocorrências recentes | lista 8/13 |
| HU18 | Filtrar por tipo | filtro 11/13 |
| HU21 | Abrir detalhes de ocorrência | base para decisão |
| HU22 | Confirmar ocorrência | validação humana |
| HU23 | Rejeitar ocorrência | validação humana/auditoria |
| HU44 | Registrar histórico de status | rastreabilidade |
| HU47 | Omitir dados pessoais no mapa público | privacidade |
| HU49 | Controlar acesso ao dashboard | segurança |
| HU51 | Usar interface responsiva | uso web/PWA em campo |
| HU53 | Validar fluxo completo | objetivo do MVP |
| HU56 | Filtrar por data/período | filtro 9/13 |
| HU60 | Explicação em linguagem simples | 11/13 querem versão simples disponível |

## P1 — Alto valor funcional/analítico

| Código | História | Fundamentação principal |
|---|---|---|
| HU02 | Informar descrição textual | contexto e NLP |
| HU06 | Visualizar pré-análise | confiança/transparência |
| HU07 | Consultar status | acompanhamento |
| HU08 | Complementar informações | reduz dados incompletos |
| HU10 | Filtrar mapa público por tipo | navegação |
| HU11 | Definir raio | filtro 7/13 |
| HU19 | Filtrar por status | operação do gestor |
| HU20 | Filtrar por confiança | triagem |
| HU24 | Solicitar mais informações | qualidade de dados |
| HU25 | Corrigir classificação da IA | human-in-the-loop |
| HU26 | Visualizar total de ocorrências | painel analítico 10/13 |
| HU27 | Visualizar por tipo | painel analítico |
| HU28 | Visualizar por período | painel analítico |
| HU29 | Visualizar por região | painel analítico/geográfico |
| HU30 | Taxa de confirmação | qualidade do fluxo |
| HU32 | Previsão de risco por região | 24–48 h = 9/13; tela previsão 7/13 |
| HU33 | Previsão por tipo | coerência multi-hazard |
| HU34 | Exibir fatores/contexto | transparência |
| HU36 | Servir modelo via API | integração arquitetural |
| HU37 | Classificar imagem | CV e fluxo do protótipo |
| HU38 | Classificar texto | multimodalidade |
| HU39 | Combinar sinais | MSL recomenda abordagem multimodal/híbrida |
| HU40 | Marcar ambiguidade | revisão humana |
| HU43 | Configurar limiares | regra de confirmação sem consenso global |
| HU45 | Registrar resultado da IA | auditoria/reprodutibilidade |
| HU48 | Informar caráter experimental | rigor acadêmico |
| HU50 | Mensagens claras de erro | usabilidade |
| HU52 | Estado vazio | usabilidade |
| HU54 | Avaliar modelos | requisito científico |
| HU55 | Documentar limitações | rigor científico |
| HU58 | Registrar proveniência | reprodutibilidade |
| HU59 | Limitar duplicidade/spam | risco levantado no formulário |
| HU62 | Cadastro/autenticação do cidadão | preferência majoritária por cadastro |

## P2 — Pesquisa avançada / expansão

| Código | História | Fundamentação principal |
|---|---|---|
| HU12 | Detalhes públicos ampliados | pode ser simplificado no MVP |
| HU31 | Confiança média da IA | indicador secundário |
| HU35 | Comparar Random Forest e XGBoost | experimento de pesquisa |
| HU41 | Gerenciar usuários gestores | administração completa |
| HU42 | Configurar categorias | expansão COBRADE |
| HU46 | Exportar dados | útil, mas não bloqueia fluxo |
| HU57 | Integrar fontes externas | alto valor, maior custo de integração |
| HU61 | Evidência visual/Grad-CAM | alta demanda, porém XAI pós-MVP |

---

# 20. Fases recomendadas de implementação

A implementação deve respeitar dependências técnicas. Isso evita colocar IA avançada antes de existir um fluxo operacional funcional.

## Fase 1 — Núcleo operacional e telas principais

1. Aplicativo web/PWA responsivo.
2. Registro com foto, GPS, data/hora, urgência e risco humano.
3. Persistência local e fila de sincronização offline.
4. Dashboard com mapa em tempo real/atualizado e lista.
5. Filtros por tipo e data/período; raio quando aplicável.
6. Tela de detalhes.
7. Confirmação/rejeição humana.
8. Histórico de status/auditoria.
9. Mapa público apenas com ocorrências confirmadas.
10. Privacidade, controle de acesso e mensagens de erro.

## Fase 2 — Painel analítico e IA preliminar

1. Indicadores do painel analítico.
2. Classificação visual preliminar.
3. Classificação textual simples/pré-treinada.
4. Confiança percentual e explicação simples.
5. Registro da versão do modelo e das inferências.
6. Dataset sintético de risco.
7. API de previsão.
8. Previsão regional priorizando 24–48 h e, quando viável, 7 dias.

## Fase 3 — Integração e pesquisa avançada

1. Integração progressiva com dados INPE, chuva/nível de rio, estações, históricos e fontes satelitais.
2. Comparação de modelos de previsão.
3. Combinação multimodal mais robusta.
4. XAI visual (Grad-CAM) e análise por atributos (SHAP), quando viável.
5. Expansão para novas categorias COBRADE.
6. Validação de campo e integração institucional como trabalho futuro.

---

# 21. Matriz de rastreabilidade — evidência → decisão de requisito

| Evidência | Fonte | Decisão de requisito |
|---|---|---|
| Mapa em tempo real 12/13 | FORM | HU16 em P0 |
| Painel analítico 10/13 | FORM | HU26–HU29 elevados para P1 |
| Lista de ocorrências 8/13 | FORM | HU17 em P0 |
| Foto 12/13 | FORM | HU03 em P0; foto como evidência principal |
| GPS automático 11/13 | FORM | HU04 em P0 |
| Urgência 9/13; vítimas/risco 8/13 | FORM | HU01 passa a registrar esses campos |
| Falta de internet: 12 “sim” + 1 “às vezes” | FORM | HU13–HU15 em P0; offline-first deixa de ser posterior |
| Filtro por tipo 11/13 | FORM | HU18 em P0 |
| Filtro por data/período 9/13 | FORM | criação da HU56 |
| Raio/distância 7/13 | FORM | HU11 mantida relevante |
| Confiança (%) 10/13 | FORM | HU06/HU20 reforçadas |
| Grad-CAM 10/13 | FORM | criação da HU61, adiada para pós-MVP |
| Explicação simples ou dupla 11/13 | FORM | criação da HU60 em P0 |
| Horizonte 24–48 h 9/13 | FORM | HU32 prioriza 24–48 h |
| Histórico comparativo 7/13 | FORM | HU32/HU34 permitem comparação histórica |
| Equipe interna valida 9/13; campo 6/13 | FORM | manutenção da validação humana do gestor |
| Limiar ≥80% 5/13 e “depende do desastre” 5/13 | FORM | RN18/HU43: limiar configurável por tipo |
| Dados incompletos/geolocalização/padronização/integração | FORM | validação de campos, GPS, COBRADE e HU57 |
| Climatológicos 25; hidrológicos 21 | MSL | mantém foco em incêndios/queimadas e inundações/alagamentos |
| Integração de dados heterogêneos é lacuna recorrente | MSL | HU57 e HU58 |
| Conectividade/custo computacional são limitações | MSL | offline-first, responsividade e arquitetura leve |
| Tipos de dados distintos exigem técnicas distintas | MSL | separação entre CV, NLP e previsão |
| Recall/F1 mais adequados que acurácia isolada em cenário crítico | MSL | HU54/RN26 |
| XAI/interpretabilidade relevante para confiança | MSL + FORM | HU60 no núcleo; HU61 como evolução |
| Aplicações Web/Mobile + crowdsourcing | MSL + DESIGN | web/PWA cidadão + dashboard gestor |
| IA como suporte à decisão | MSL + DESIGN | RN01/RN19; confirmação permanece humana |

---

# 22. Requisitos consolidados para uso no relatório

## 22.1 Requisitos funcionais principais

| Código | Requisito funcional | Histórias relacionadas |
|---|---|---|
| RF01 | Registrar ocorrência ambiental georreferenciada | HU01–HU05 |
| RF02 | Capturar foto e permitir evidência multimídia | HU03 |
| RF03 | Registrar urgência e presença de vítimas/risco humano | HU01 |
| RF04 | Funcionar offline e sincronizar posteriormente | HU13–HU15 |
| RF05 | Exibir mapa público apenas com ocorrências confirmadas | HU09–HU12 |
| RF06 | Exibir mapa operacional e lista para gestores | HU16–HU17 |
| RF07 | Filtrar por tipo, período, status, confiança e raio quando aplicável | HU18–HU20, HU56, HU11 |
| RF08 | Exibir detalhes completos da ocorrência | HU21 |
| RF09 | Permitir confirmação, rejeição e solicitação de complemento por humano | HU22–HU25 |
| RF10 | Exibir painel analítico com indicadores por tipo, tempo e região | HU26–HU31 |
| RF11 | Gerar previsão experimental regional em horizontes úteis | HU32–HU34 |
| RF12 | Exibir confiança e explicação simples das inferências | HU06, HU60 |
| RF13 | Executar classificação preliminar por imagem/texto | HU37–HU40 |
| RF14 | Permitir configuração/versionamento de parâmetros de IA | HU43, HU45, HU58 |
| RF15 | Integrar progressivamente fontes externas ambientais | HU57 |
| RF16 | Registrar proveniência de dados e inferências | HU58 |
| RF17 | Exportar dados para análise | HU46 |
| RF18 | Controlar acesso e proteger dados pessoais | HU47, HU49, HU62 |
| RF19 | Sinalizar duplicidade/spam sem exclusão automática | HU59 |
| RF20 | Oferecer evidência XAI visual em fase avançada | HU61 |

## 22.2 Requisitos não funcionais principais

| Código | Requisito não funcional | Justificativa |
|---|---|---|
| RNF01 | Usabilidade em conexão instável/offline | FORM + MSL |
| RNF02 | Responsividade em dispositivos móveis e desktop | DESIGN + MSL |
| RNF03 | Pré-análise em até 5 min, buscando resposta quase imediata | FORM |
| RNF04 | Privacidade e minimização de dados pessoais | FORM + DESIGN |
| RNF05 | Rastreabilidade de status, decisões, dados e versão do modelo | MSL |
| RNF06 | Transparência sobre confiança, incerteza e caráter experimental | FORM + MSL |
| RNF07 | Reprodutibilidade das avaliações de ML | MSL |
| RNF08 | Extensibilidade para novas categorias COBRADE | MSL |
| RNF09 | Resiliência a falha de fonte externa/serviço de IA | MSL + ARQ |
| RNF10 | Controle de acesso por papel | DESIGN + ARQ |
| RNF11 | Segurança informacional no mapa público | FORM + DESIGN |
| RNF12 | Avaliação de IA com métricas adequadas ao risco, não apenas acurácia | MSL |


## 22.3 Rastreabilidade das telas/fluxos do protótipo

| Tela ou fluxo de design | Histórias/requisitos que materializa |
|---|---|
| Registro/câmera do cidadão | HU01–HU06, RF01–RF03 |
| Acompanhamento da ocorrência | HU07–HU08 |
| Mapa público do cidadão | HU09–HU12, RF05 |
| Estado offline/sincronização | HU13–HU15, RF04 |
| Dashboard com mapa | HU16, HU18–HU20, HU56, RF06–RF07 |
| Lista de ocorrências | HU17–HU20, HU56 |
| Detalhes e validação | HU21–HU25, RF08–RF09 |
| Painel analítico | HU26–HU31, RF10 |
| Tela de previsão | HU32–HU34, HU60, RF11–RF12 |
| Administração/usuários/logs | HU41–HU45, HU49, HU58 |
| Exportação/relatórios | HU46 |
| XAI avançada | HU61, RF20 |

Essa matriz deve ser usada para verificar cobertura: uma tela pode implementar várias histórias e uma história pode aparecer em mais de uma tela.

## 22.4 Restrições arquiteturais já definidas

As histórias não determinam a tecnologia, mas o protótipo possui decisões arquiteturais já adotadas que condicionam sua implementação:

- interfaces web responsivas/PWA para cidadão e dashboard;
- frontend baseado em React/Next.js com TypeScript;
- backend principal em Node.js/Express com Prisma;
- PostgreSQL como banco relacional principal;
- serviço de IA isolado via API, implementável em FastAPI/Python;
- execução integrada dos componentes por contêineres/Docker Compose;
- IA desacoplada da regra de confirmação: o backend mantém a autoridade do fluxo e o gestor humano mantém a autoridade da validação.

Essas decisões devem ser tratadas como **restrições de arquitetura do protótipo**, não como evidência de necessidade do usuário.

---


# 23. Observação metodológica para o relatório

Este conjunto deve ser apresentado como **requisitos consolidados do protótipo**, obtidos por triangulação entre evidência científica, levantamento com usuários e material de projeto.

Formulação recomendada:

> Os requisitos do protótipo foram derivados por triangulação de três fontes principais: os resultados do Mapeamento Sistemático da Literatura, que reuniu 42 estudos primários; um levantamento de requisitos aplicado a 13 participantes com atuação ou experiência relacionada ao domínio; e as telas e fluxos previamente desenvolvidos durante a etapa de prototipação. O mapeamento forneceu a fundamentação técnica para o uso de sistemas inteligentes, dados heterogêneos, visão computacional, modelos preditivos e mecanismos de rastreabilidade, enquanto o levantamento com usuários permitiu priorizar aspectos operacionais como funcionamento offline, geolocalização, evidência visual, filtros de mapa, visualização analítica, horizontes de previsão e transparência das inferências. As histórias de usuário foram então revisadas e priorizadas considerando simultaneamente valor percebido, evidência científica, dependências do fluxo e viabilidade de implementação no contexto do PIBIC.

Ao relatar resultados do formulário:

- informar que `n = 13`;
- usar contagem absoluta junto ao percentual;
- evitar generalizações populacionais;
- tratar os resultados como evidência de priorização do protótipo;
- distinguir requisito desejado de requisito implementado;
- deixar claro quando uma funcionalidade foi adiada por escopo, como XAI avançada;
- não apresentar a IA como autoridade de confirmação ou sistema oficial de alerta.

