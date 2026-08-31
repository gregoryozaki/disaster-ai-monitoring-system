# 04 — Protocolo de Avaliação Independente do Classificador NLP

## 1. Objetivo

Este protocolo define a avaliação independente dos classificadores de texto do KAMARA após o encerramento da rodada sintética NLP v2.

A finalidade é estimar a capacidade de generalização dos modelos fora da distribuição utilizada na geração dos 9.000 exemplos sintéticos de treino, validação e teste.

Os modelos avaliados serão congelados antes desta etapa:

- `tfidf_logreg_v2`
- `kamara_bertimbau_v2`

Nenhum exemplo deste conjunto independente poderá ser utilizado para:

- treinamento;
- ajuste de hiperparâmetros;
- escolha de checkpoint;
- ajuste de limiar;
- regeneração ou curadoria do dataset sintético;
- seleção de palavras, expressões ou regras específicas para melhorar o resultado;
- novo treinamento após inspeção das previsões.

A avaliação independente é exclusivamente uma etapa de teste.

---

## 2. Relação com a rodada NLP v2

A rodada sintética v2 foi encerrada antes da criação deste conjunto independente.

O conjunto sintético possui nove classes:

1. `COBRADE_1_2_1_0_0` — Inundações;
2. `COBRADE_1_2_2_0_0` — Enxurradas;
3. `COBRADE_1_2_3_0_0` — Alagamentos;
4. `COBRADE_1_4_1_3_1` — Incêndio florestal em parques, áreas de proteção ambiental e áreas de preservação permanente;
5. `COBRADE_1_4_1_3_2` — Incêndio florestal em áreas não protegidas, com reflexos na qualidade do ar;
6. `COBRADE_2_3_1_1_0` — Incêndios em plantas e distritos industriais, parques e depósitos;
7. `COBRADE_2_3_1_2_0` — Incêndios em aglomerados residenciais;
8. `OTHER` — evento identificável, mas fora das sete classes-alvo;
9. `INSUFFICIENT_INFO` — informação insuficiente para selecionar com segurança uma das classes anteriores.

O teste sintético v2 já foi consumido e não deve ser utilizado novamente para orientar mudanças no modelo.

---

## 3. Hipótese de avaliação

O desempenho observado no conjunto sintético pode superestimar a generalização para relatos reais ou humanos.

A avaliação independente deverá responder principalmente:

1. Os modelos mantêm desempenho aceitável fora da distribuição sintética?
2. Qual modelo generaliza melhor: TF-IDF + Regressão Logística ou BERTimbau?
3. Quais classes apresentam maior queda de desempenho?
4. Quais erros são causados por ambiguidade real, linguagem informal, negação, ausência de contexto ou mudança de domínio?
5. Há sinais de dependência de atalhos lexicais presentes no dataset sintético?
6. Os modelos apresentam confiança alta em previsões semanticamente erradas?

---

## 4. Tamanho e distribuição do conjunto

A primeira versão do conjunto independente deverá conter **270 exemplos**, com distribuição balanceada:

| Classe | Quantidade |
|---|---:|
| COBRADE_1_2_1_0_0 | 30 |
| COBRADE_1_2_2_0_0 | 30 |
| COBRADE_1_2_3_0_0 | 30 |
| COBRADE_1_4_1_3_1 | 30 |
| COBRADE_1_4_1_3_2 | 30 |
| COBRADE_2_3_1_1_0 | 30 |
| COBRADE_2_3_1_2_0 | 30 |
| OTHER | 30 |
| INSUFFICIENT_INFO | 30 |
| **Total** | **270** |

O balanceamento é uma decisão experimental e não representa a prevalência real das classes na população.

---

## 5. Origem dos exemplos

O conjunto independente não deve ser produzido pelo mesmo processo de geração sintética utilizado no dataset NLP v2.

São permitidas as seguintes origens:

### 5.1. `public_real`

Trechos provenientes de fontes públicas reais, por exemplo:

- Defesa Civil;
- órgãos municipais, estaduais ou federais;
- comunicados institucionais;
- boletins públicos;
- notícias;
- relatórios públicos;
- outras fontes públicas que descrevam eventos compatíveis com a tarefa.

Quando necessário, o trecho poderá ser reduzido ao relato relevante, desde que a edição não altere o significado necessário para a classificação.

### 5.2. `human_authored`

Relatos escritos manualmente por pessoas para representar situações plausíveis, sem acesso às previsões dos modelos.

Essa origem é especialmente útil para:

- `INSUFFICIENT_INFO`;
- linguagem informal;
- abreviações;
- mensagens curtas;
- descrições indiretas;
- situações ambíguas;
- relatos semelhantes aos que poderiam ser enviados por cidadãos.

Esses textos não devem copiar nem parafrasear deliberadamente exemplos do dataset sintético.

### 5.3. Combinação recomendada

Sempre que possível, priorizar fontes reais para as sete classes COBRADE e `OTHER`.

`INSUFFICIENT_INFO` poderá conter maior participação de exemplos `human_authored`, pois a classe representa insuficiência semântica para a tarefa, e não necessariamente uma categoria encontrada explicitamente em bases públicas.

---

## 6. Proibições durante a coleta

Durante a criação do conjunto independente, não é permitido:

- pedir a um modelo treinado para sugerir exemplos em que ele provavelmente erraria;
- selecionar exemplos com base nas previsões do TF-IDF ou do BERTimbau;
- executar os modelos durante a rotulação;
- rejeitar exemplos porque parecem difíceis para o modelo;
- reescrever textos para aumentar artificialmente a separabilidade entre classes;
- utilizar textos do próprio dataset sintético como fonte;
- criar paráfrases de exemplos sintéticos conhecidos;
- alterar rótulos depois de observar a previsão do modelo;
- substituir exemplos errados depois da avaliação.

A coleta, a rotulação e o congelamento devem ocorrer antes da primeira inferência.

---

## 7. Critérios semânticos de rotulação

As mesmas regras semânticas definidas para o dataset NLP v2 devem ser utilizadas.

### 7.1. Inundação — `COBRADE_1_2_1_0_0`

Selecionar quando houver evidência de transbordamento de curso d'água, saída do leito normal ou ocupação de áreas normalmente secas por elevação do nível do rio, igarapé, córrego ou equivalente.

A elevação do nível da água, sem evidência suficiente de transbordamento, não deve ser automaticamente classificada como inundação.

### 7.2. Enxurrada — `COBRADE_1_2_2_0_0`

Selecionar quando houver escoamento superficial rápido, súbito e/ou de alta energia, especialmente quando houver arrasto de veículos, objetos, sedimentos ou detritos.

Acúmulo de água sem evidência de fluxo rápido não caracteriza enxurrada.

### 7.3. Alagamento — `COBRADE_1_2_3_0_0`

Selecionar quando houver acúmulo de água associado à drenagem urbana excedida ou insuficiente, como ruas, bairros, avenidas, túneis ou passagens tomadas pela água.

Não usar para transbordamento explícito de curso d'água nem para fluxo de alta energia.

### 7.4. Incêndio florestal protegido — `COBRADE_1_4_1_3_1`

Exigir simultaneamente:

- incêndio ou fogo em vegetação; e
- contexto explícito de parque, unidade de conservação, área de proteção ambiental, área de preservação permanente ou outra área protegida compatível.

A expressão genérica "fogo na mata" não é suficiente para esta classe.

### 7.5. Incêndio florestal não protegido — `COBRADE_1_4_1_3_2`

Exigir:

- incêndio em vegetação em contexto não protegido; e
- informação compatível com reflexos na qualidade do ar, fumaça ou impacto atmosférico associado.

### 7.6. Incêndio industrial — `COBRADE_2_3_1_1_0`

Exigir incêndio efetivo em:

- fábrica;
- planta industrial;
- distrito ou parque industrial;
- depósito;
- armazém ou instalação equivalente compatível.

Apenas mencionar fumaça nas proximidades de uma indústria não é suficiente.

### 7.7. Incêndio em aglomerado residencial — `COBRADE_2_3_1_2_0`

Exigir contexto de múltiplas habitações, conjunto ou aglomeração residencial.

Incêndio em uma residência isolada não deve ser automaticamente classificado nessa classe.

### 7.8. `OTHER`

Utilizar quando o evento é identificável, mas está fora das sete classes COBRADE alvo.

Exemplos possíveis incluem:

- deslizamento;
- vendaval;
- seca/estiagem;
- colapso estrutural;
- contaminação de água;
- rompimento de barragem;
- granizo;
- erosão;
- vazamento químico;
- outros eventos fora do escopo.

### 7.9. `INSUFFICIENT_INFO`

Utilizar quando o texto não possui informação suficiente para selecionar com segurança uma das oito classes anteriores.

Situações de:

- hipótese;
- risco futuro;
- descrição excessivamente vaga;
- ausência de evidência necessária;
- relato curto sem contexto discriminante;
- negação sem evento classificável;

podem pertencer a esta classe.

Não utilizar `INSUFFICIENT_INFO` quando o evento fora do escopo estiver suficientemente identificado; nesse caso, utilizar `OTHER`.

---

## 8. Processo de anotação

A anotação deve ocorrer sem acesso às previsões dos modelos.

Para cada exemplo:

1. ler o texto;
2. determinar se há evento identificável;
3. aplicar as regras semânticas;
4. registrar o rótulo;
5. registrar a justificativa mínima da decisão;
6. marcar o status da anotação.

Estados recomendados:

- `confirmed`;
- `needs_review`;
- `excluded`.

Somente exemplos `confirmed` entrarão na avaliação final.

Quando houver dúvida real entre duas classes, o exemplo deve ser revisado antes do congelamento. Não escolher um rótulo arbitrariamente apenas para preencher a cota da classe.

---

## 9. Revisão das anotações

Idealmente, exemplos difíceis deverão ser revisados por uma segunda pessoa com acesso às mesmas regras semânticas.

Se houver dois anotadores, registrar:

- rótulo do anotador A;
- rótulo do anotador B;
- existência ou não de concordância;
- rótulo final após adjudicação.

Se o projeto não dispuser de um segundo anotador, essa limitação deverá ser declarada explicitamente no relatório científico.

A IA avaliada não poderá atuar como adjudicadora do próprio conjunto de teste.

---

## 10. Esquema do arquivo

Arquivo:

```text
ml/data/external/nlp/independent_test_v1.jsonl
```

Campos recomendados:

```json
{
  "sample_id": "independent_v1_0001",
  "text": "Texto apresentado ao classificador.",
  "target_label": "COBRADE_1_2_1_0_0",
  "source_type": "public_real",
  "source_name": "Nome da fonte",
  "source_ref": "Referência ou URL da fonte",
  "source_date": "YYYY-MM-DD",
  "collected_at": "YYYY-MM-DD",
  "annotation_status": "confirmed",
  "annotation_notes": "Evidência observada para o rótulo.",
  "modified_from_source": false
}
```

Apenas o campo `text` poderá ser utilizado como entrada dos classificadores.

`target_label` é exclusivamente o alvo da avaliação.

Os campos de proveniência e anotação nunca entram no modelo.

---

## 11. Preservação do texto

O texto deverá ser preservado o máximo possível.

Não normalizar automaticamente:

- acentos;
- caixa;
- abreviações;
- erros ortográficos;
- repetição de caracteres;
- gírias;
- palavrões;
- emojis;
- pontuação;
- gramática informal.

Quando o texto for proveniente de uma fonte pública e precisar ser recortado, registrar `modified_from_source: true`.

A edição deve apenas remover conteúdo irrelevante ou contexto externo, sem introduzir informação nova.

---

## 12. Privacidade

Não incluir dados pessoais desnecessários no conjunto.

Quando uma fonte pública contiver informações identificáveis que não sejam necessárias para a classificação, remover ou generalizar esses trechos antes de armazenar o exemplo.

Não registrar:

- nomes completos de cidadãos;
- telefones;
- documentos;
- endereços residenciais completos;
- outras informações pessoais desnecessárias.

A remoção de informação pessoal não deve alterar a evidência semântica necessária para o rótulo.

---

## 13. Controle de vazamento com o dataset sintético

Antes da avaliação dos modelos, o conjunto independente deverá ser comparado com:

```text
ml/data/raw/nlp/*.jsonl
```

e/ou com o consolidado sintético correspondente.

Devem ser verificados pelo menos:

- duplicatas exatas;
- textos normalizados idênticos;
- similaridade textual elevada;
- paráfrases evidentemente derivadas do dataset sintético.

Um exemplo independente que seja cópia ou quase cópia evidente de um exemplo sintético deverá ser substituído **antes** da execução dos modelos.

Essa verificação serve para evitar leakage entre treino/validação/teste sintético e o teste independente.

---

## 14. Congelamento do conjunto

Antes da primeira inferência:

1. todos os 270 exemplos devem estar presentes;
2. todos os rótulos devem estar definidos;
3. todos os exemplos devem possuir `annotation_status = confirmed`;
4. a distribuição deve ser 30 exemplos por classe;
5. a checagem de duplicação/leakage deve estar concluída;
6. o arquivo deve receber um SHA-256;
7. o hash deve ser registrado no relatório da avaliação.

Após esse ponto, o conjunto é considerado congelado.

Nenhuma alteração deve ser realizada com base nas previsões dos modelos.

---

## 15. Avaliação dos modelos

Avaliar exatamente os artefatos congelados:

```text
ml/artifacts/nlp/tfidf_logreg_v2/
ml/artifacts/nlp/kamara_bertimbau_v2/
```

Não executar treinamento.

Para cada modelo registrar:

- accuracy;
- macro precision;
- macro recall;
- macro F1;
- weighted F1;
- precision, recall e F1 por classe;
- matriz de confusão;
- quantidade total de erros;
- previsão por exemplo;
- confiança da previsão, quando disponível.

O **Macro-F1** será a métrica principal por tratar igualmente as nove classes.

---

## 16. Comparação pareada

Além das métricas agregadas, comparar as previsões dos dois modelos por exemplo.

Registrar:

- ambos acertaram;
- somente TF-IDF acertou;
- somente BERTimbau acertou;
- ambos erraram;
- total de discordâncias.

Os exemplos em que os modelos discordarem ou ambos errarem deverão receber análise qualitativa.

---

## 17. Análise qualitativa de erros

Cada erro deverá ser classificado, quando possível, em uma ou mais categorias:

- `semantic_boundary` — fronteira real entre classes;
- `insufficient_context` — informação limitada;
- `negation` — interpretação incorreta de negação;
- `lexical_shortcut` — associação excessiva a palavra ou expressão;
- `informal_language` — linguagem informal, abreviação ou erro;
- `out_of_scope_confusion` — evento `OTHER` confundido com classe-alvo;
- `high_confidence_error` — erro com confiança elevada;
- `annotation_question` — possível problema de anotação identificado durante a análise;
- `other`.

`annotation_question` deve ser registrado como observação e não utilizado para alterar retroativamente o rótulo depois que o conjunto estiver congelado, salvo se for constatado erro factual de anotação independente das previsões. Qualquer correção excepcional deverá ser documentada e uma nova versão do conjunto deverá ser criada.

---

## 18. Interpretação

O resultado no conjunto independente deverá ser reportado separadamente do resultado sintético.

Não apresentar as métricas sintéticas como estimativa direta de desempenho em relatos reais.

Comparações recomendadas:

| Modelo | Validation sintética | Teste sintético | Teste independente |
|---|---:|---:|---:|
| TF-IDF v2 | registrar | registrar | medir |
| BERTimbau v2 | registrar | registrar | medir |

Uma queda no conjunto independente deve ser interpretada como evidência de mudança de distribuição ou `synthetic-to-real gap`, e não escondida por novo ajuste no teste.

---

## 19. Critério para escolha do modelo

A escolha final não será feita apenas pela maior accuracy.

Considerar conjuntamente:

1. Macro-F1 independente;
2. desempenho por classe;
3. comportamento em `OTHER`;
4. comportamento em `INSUFFICIENT_INFO`;
5. erros de alta confiança;
6. robustez a linguagem real/informal;
7. natureza dos erros;
8. custo computacional e operacional;
9. compatibilidade com o serviço de IA;
10. necessidade de explicabilidade e manutenção.

Uma diferença pequena entre modelos não deverá ser tratada automaticamente como superioridade conclusiva.

---

## 20. Uso posterior do conjunto

Após a primeira avaliação, `independent_test_v1` passa a ser um conjunto de teste consumido.

Ele não poderá ser utilizado como dataset de treinamento da mesma rodada experimental.

Caso o projeto posteriormente incorpore esses exemplos ao treinamento, deverá:

- criar uma nova versão do dataset;
- criar uma nova versão dos modelos;
- criar um novo conjunto independente que não tenha sido utilizado anteriormente.

---

## 21. Estrutura de diretórios

Estrutura prevista:

```text
ml/
├── data/
│   └── external/
│       └── nlp/
│           └── independent_test_v1.jsonl
│
├── evaluation/
│   └── nlp/
│       └── independent_test_v1/
│           ├── dataset_audit.json
│           ├── model_comparison.csv
│           ├── paired_predictions.csv
│           ├── error_analysis.csv
│           ├── tfidf_logreg_v2/
│           │   ├── metrics.json
│           │   ├── per_class_metrics.csv
│           │   ├── predictions.csv
│           │   └── confusion_matrix.csv
│           └── kamara_bertimbau_v2/
│               ├── metrics.json
│               ├── per_class_metrics.csv
│               ├── predictions.csv
│               └── confusion_matrix.csv
│
└── methodology/
    └── nlp/
        └── 04_protocolo_avaliacao_independente.md
```

Os nomes exatos dos arquivos de avaliação poderão ser ajustados quando o script for implementado, desde que a rastreabilidade seja mantida.

---

## 22. Ordem obrigatória da etapa

A execução deverá seguir esta ordem:

```text
1. Criar protocolo
2. Coletar exemplos
3. Rotular sem acesso às previsões
4. Revisar anotações
5. Verificar privacidade
6. Verificar duplicatas/leakage
7. Fechar 30 exemplos por classe
8. Calcular SHA-256
9. Congelar independent_test_v1
10. Executar TF-IDF v2
11. Executar BERTimbau v2
12. Calcular métricas
13. Comparar os modelos
14. Fazer análise qualitativa dos erros
15. Escolher o modelo para integração
```

A execução dos modelos somente começa após a conclusão do item 9.

---

## 23. Limitações a declarar

Mesmo com este protocolo, a avaliação possui limitações que deverão ser explicitadas:

- 270 exemplos ainda constituem uma amostra relativamente pequena;
- o balanceamento artificial não representa prevalência real;
- fontes públicas podem usar linguagem diferente da utilizada por cidadãos;
- exemplos manualmente escritos não são equivalentes a produção real;
- uma única anotação humana pode introduzir subjetividade;
- classes COBRADE próximas apresentam fronteiras semânticas reais;
- o conjunto independente não elimina todos os possíveis vieses do processo sintético.

O objetivo desta etapa é produzir evidência de generalização mais forte do que a avaliação puramente sintética, e não afirmar desempenho definitivo em produção.

---

## 24. Regra de encerramento

Depois que `independent_test_v1` for avaliado, seus resultados deverão ser preservados como evidência experimental.

Qualquer desenvolvimento posterior motivado pelos erros observados deverá pertencer a uma nova rodada/versionamento de modelo e ser avaliado em um novo conjunto independente.
