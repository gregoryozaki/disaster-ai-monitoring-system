# 01 — Definição da Tarefa e Esquema do Dataset NLP

## 1. Objetivo

Este documento define a tarefa de aprendizado supervisionado e o esquema do dataset sintético textual da primeira versão do componente NLP do KAMARA.

O componente textual tem como objetivo realizar **pré-análise de descrições de ocorrências em português brasileiro**, produzindo uma sugestão de classe para apoiar a análise humana. A saída do modelo não substitui a validação do gestor e não deve alterar automaticamente o estado final de uma ocorrência.

A construção do dataset será sintética e orientada por LLM, porém controlada por:

- taxonomia explícita;
- regras semânticas de domínio;
- planejamento prévio de diversidade linguística;
- geração piloto antes da geração completa;
- curadoria estrutural e semântica;
- rastreabilidade de prompts, modelo gerador, lotes e versões;
- avaliação separada da geração.

A metodologia reaproveita a lógica do pipeline utilizado anteriormente para geração sintética tabular, mas remove elementos específicos daquele contexto, como Weka, ARFF, valores faltantes artificiais, outliers numéricos e ruído tabular.

---

## 2. Tarefa de aprendizado

### 2.1 Tipo de tarefa

Classificação textual multiclasse supervisionada.

Entrada:

```text
descrição textual de uma ocorrência
```

Saída:

```text
uma classe textual do escopo NLP v1
```

O modelo poderá posteriormente fornecer também:

- confiança da classificação;
- indicação de incerteza por threshold;
- classe COBRADE sugerida, quando aplicável.

### 2.2 Unidade de análise

Cada instância representa **uma descrição textual autossuficiente de uma ocorrência**.

Exemplos de unidade de análise:

```text
"O rio transbordou lentamente e a água entrou nas casas próximas à margem."
```

```text
"Depois da chuva forte, a água ficou acumulada na avenida porque os bueiros não deram vazão."
```

A unidade de análise não representa:

- uma imagem;
- um par imagem-texto;
- uma ocorrência completa com todos os seus metadados;
- uma decisão final de Defesa Civil;
- uma validação humana.

O dataset NLP é textual. A fusão com o classificador visual será tratada posteriormente em uma etapa multimodal separada.

---

## 3. Idioma e domínio

Idioma principal:

```text
pt-BR
```

Domínio:

```text
relatos de desastres e ocorrências potencialmente classificáveis pela COBRADE
```

Os textos devem representar formas plausíveis de relato de cidadãos ou operadores, incluindo linguagem formal e informal, sem utilizar dados pessoais reais.

Não devem ser gerados:

- nomes reais de pessoas;
- números de documentos;
- telefones;
- e-mails;
- endereços residenciais reais;
- qualquer outro dado pessoal identificável.

Localizações genéricas ou fictícias podem ser utilizadas quando necessárias para dar naturalidade ao relato.

---

## 4. Escopo de classes da versão NLP v1

A primeira versão não tentará classificar todas as categorias COBRADE.

O escopo foi reduzido às categorias diretamente relacionadas às famílias visuais já contempladas pelo classificador visual do projeto, acrescidas de duas classes de controle.

### 4.1 Classes COBRADE

| target_label | Código COBRADE | Nome |
|---|---|---|
| `COBRADE_1_2_1_0_0` | `1.2.1.0.0` | Inundações |
| `COBRADE_1_2_2_0_0` | `1.2.2.0.0` | Enxurradas |
| `COBRADE_1_2_3_0_0` | `1.2.3.0.0` | Alagamentos |
| `COBRADE_1_4_1_3_1` | `1.4.1.3.1` | Incêndio florestal - Incêndios em parques, áreas de proteção ambiental e áreas de preservação permanente |
| `COBRADE_1_4_1_3_2` | `1.4.1.3.2` | Incêndio florestal - Incêndios em áreas não protegidas, com reflexos na qualidade do ar |
| `COBRADE_2_3_1_1_0` | `2.3.1.1.0` | Incêndios em plantas e distritos industriais, parques e depósitos |
| `COBRADE_2_3_1_2_0` | `2.3.1.2.0` | Incêndios em aglomerados residenciais |

### 4.2 Classes de controle

#### `OTHER`

Usada quando o texto contém informação suficiente para identificar que existe um evento, mas o evento **está claramente fora das sete classes COBRADE contempladas pelo NLP v1**.

Exemplo:

```text
"Uma encosta deslizou depois da chuva e atingiu parte da estrada."
```

O relato descreve um evento identificável, porém fora do conjunto-alvo do classificador.

#### `INSUFFICIENT_INFO`

Usada quando o texto não contém evidência semântica suficiente para selecionar com segurança nenhuma das sete classes COBRADE.

Exemplo:

```text
"Tem um problema sério aqui e precisamos de ajuda."
```

Também pode ser utilizada em relatos nos quais existe um possível evento do escopo, mas faltam informações necessárias para determinar a categoria exata.

---

## 5. Relação com o classificador visual

O componente visual atual trabalha com classes amplas:

```text
FLOOD_WATER
FIRE_SMOKE
OTHER
UNCERTAIN
```

O NLP v1 deve acrescentar informação semântica mais específica.

Exemplo:

```text
Imagem
  ↓
FLOOD_WATER

Texto
  ↓
"Inundação", "Enxurrada" ou "Alagamento"
```

Para incêndios:

```text
Imagem
  ↓
FIRE_SMOKE

Texto
  ↓
tipo de contexto ambiental, industrial ou residencial
```

Nesta fase, entretanto, **não será treinado um modelo multimodal**. O dataset deve permitir avaliar o classificador textual isoladamente.

---

## 6. Esquema do dataset bruto

Formato principal:

```text
CSV UTF-8
```

Colunas propostas:

| Coluna | Tipo | Obrigatória | Finalidade |
|---|---|---:|---|
| `sample_id` | string | sim | identificador único da instância |
| `text` | string | sim | texto usado como entrada do classificador |
| `target_label` | string | sim | uma das nove classes permitidas |
| `cobrade_code` | string/null | sim | código COBRADE quando `target_label` for uma classe COBRADE |
| `scenario_family` | string | sim | cenário semântico representado |
| `linguistic_profile` | string | sim | perfil de linguagem solicitado na geração |
| `difficulty` | string | sim | `typical`, `intermediate` ou `hard` |
| `generation_batch` | string | sim | lote em que o exemplo foi gerado |
| `prompt_version` | string | sim | versão do prompt utilizado |
| `generator_model` | string | sim | modelo LLM utilizado na geração |
| `synthetic` | boolean | sim | `true` para dados produzidos sinteticamente |
| `review_status` | string | sim | situação da revisão da amostra |
| `review_notes` | string/null | não | observações da curadoria |

### 6.1 Coluna de entrada do modelo

A única coluna textual entregue como entrada direta ao classificador será:

```text
text
```

### 6.2 Classe-alvo

A coluna supervisionada será:

```text
target_label
```

Os demais campos são metadados de rastreabilidade e não devem ser usados como atributos de entrada do modelo.

Isso evita vazamento de informação por colunas como:

```text
cobrade_code
scenario_family
difficulty
generation_batch
```

---

## 7. Domínio dos principais atributos

### `target_label`

Valores permitidos:

```text
COBRADE_1_2_1_0_0
COBRADE_1_2_2_0_0
COBRADE_1_2_3_0_0
COBRADE_1_4_1_3_1
COBRADE_1_4_1_3_2
COBRADE_2_3_1_1_0
COBRADE_2_3_1_2_0
OTHER
INSUFFICIENT_INFO
```

### `difficulty`

Valores:

```text
typical
intermediate
hard
```

Interpretação:

- `typical`: contém pistas claras e coerentes da classe;
- `intermediate`: a classe é identificável, porém de maneira menos explícita;
- `hard`: contém ambiguidade controlada, vocabulário compartilhado, negação, temporalidade, informação indireta ou classe semanticamente próxima.

### `review_status`

Valores propostos:

```text
pending
approved
rejected
needs_revision
```

---

## 8. Regras estruturais

Todo registro deve obedecer às seguintes regras:

1. `sample_id` deve ser único.
2. `text` não pode estar vazio.
3. `target_label` deve pertencer ao conjunto fechado de classes.
4. `cobrade_code` deve corresponder à classe quando `target_label` for COBRADE.
5. `cobrade_code` deve ser nulo para `OTHER` e `INSUFFICIENT_INFO`.
6. `synthetic` deve ser verdadeiro para registros gerados por LLM.
7. `prompt_version`, `generation_batch` e `generator_model` devem ser registrados.
8. Os textos não devem conter o código COBRADE.
9. Os metadados de geração não devem ser incorporados ao campo `text`.
10. Dados pessoais reais não devem ser utilizados.

---

## 9. Geração piloto

Antes da geração completa será criada uma amostra piloto.

Quantidade inicial recomendada:

```text
30 a 50 exemplos por classe
```

Para nove classes:

```text
270 a 450 exemplos
```

A amostra piloto será usada para verificar:

- aderência às regras semânticas;
- naturalidade da linguagem;
- diversidade;
- equilíbrio entre classes;
- presença de casos difíceis;
- padrões repetitivos;
- vazamento lexical;
- problemas no prompt.

A geração completa somente deve começar depois da aprovação da amostra piloto.

---

## 10. Geração completa

A quantidade final não será congelada antes da avaliação do piloto.

A geração será feita em **lotes pequenos e rastreáveis**, separados por:

```text
classe
+
família de cenário
+
perfil linguístico
+
dificuldade
```

Não será utilizada geração determinística baseada em templates e substituição de slots como mecanismo principal do dataset.

O objetivo é reduzir o risco de o classificador aprender a estrutura do gerador em vez do fenômeno semântico de interesse.

---

## 11. Curadoria e preparação

O dataset bruto gerado por LLM não será considerado automaticamente válido.

O processo será:

```text
geração
   ↓
validação estrutural
   ↓
detecção de duplicatas
   ↓
análise de similaridade
   ↓
revisão semântica
   ↓
correção ou descarte
   ↓
dataset curado
```

Somente o dataset curado poderá ser dividido em treinamento, validação e teste.

---

## 12. Separação de treino, validação e teste

O split não deve ser puramente aleatório por linha.

Devem ser considerados como grupos de proveniência:

```text
generation_batch
prompt_version
scenario_family
```

Também deve ser feita detecção de exemplos muito semelhantes para evitar paráfrases quase idênticas em treino e teste.

Além dos splits sintéticos, deverá existir futuramente um conjunto independente:

```text
manual_evaluation.csv
```

Esse conjunto não deve ser gerado pelo mesmo pipeline usado para treinamento.

---

## 13. Critérios de aceitação do esquema

A Etapa 1 será considerada concluída quando:

- a tarefa de classificação estiver formalmente definida;
- as nove classes estiverem congeladas para a versão v1;
- os sete códigos COBRADE estiverem corretos;
- as colunas e tipos estiverem definidos;
- os metadados de proveniência estiverem estabelecidos;
- a separação entre atributos de treinamento e metadados estiver explícita;
- as classes `OTHER` e `INSUFFICIENT_INFO` estiverem semanticamente diferenciadas;
- estiver documentado que a decisão final permanece humana.

---

## 14. Artefatos associados

Artefatos derivados desta etapa:

```text
ml/config/nlp/classes.json
ml/config/nlp/dataset_schema.json
```

Este documento funciona como especificação metodológica legível por pessoas; os arquivos JSON devem representar a versão executável das regras estruturais.

---

## Referencial metodológico

- LONG, L. et al. *On LLMs-Driven Synthetic Data Generation, Curation, and Evaluation: A Survey*. Findings of ACL, 2024. DOI: 10.18653/v1/2024.findings-acl.658.
- KIM, J.; KIM, T.; CHOO, J. *EPIC: Effective Prompting for Imbalanced-Class Data Synthesis in Tabular Data Classification via Large Language Models*. arXiv:2404.12404, 2024.
- LIU, S.; ZHENG, Y.; ZHANG, Y. *StructSynth: Leveraging LLMs for Structure-Aware Tabular Data Synthesis in Low-Data Regimes*. 2025.
- ILATY, A.; SHIRAZI, H.; HOMAYOUNI, H. *SynLLM: A Comparative Analysis of Large Language Models for Medical Tabular Synthetic Data Generation via Prompt Engineering*. 2025.
- Ministério da Integração e do Desenvolvimento Regional. *Classificação e Codificação Brasileira de Desastres — COBRADE*.
