# Avaliação independente final do NLP v2

## Objetivo

Avaliar a capacidade de generalização dos classificadores NLP do KAMARA
em textos independentes do conjunto sintético utilizado no treinamento.

O conjunto independente contém 270 textos, com 30 exemplos para cada uma
das nove classes.

O conjunto não foi utilizado durante treinamento, seleção de
hiperparâmetros ou validação dos modelos.

## Modelos avaliados

- `kamara_bertimbau_v2`
- `tfidf_logreg_v2`

## Resultados globais

| Métrica | BERTimbau | TF-IDF |
|---|---:|---:|
| Accuracy | 0.796296 | 0.581481 |
| Macro Precision | 0.797298 | 0.675452 |
| Macro Recall | 0.796296 | 0.581481 |
| Macro-F1 | 0.766034 | 0.565200 |
| Weighted-F1 | 0.766034 | 0.565200 |
| Acertos | 215/270 | 157/270 |
| Erros | 55/270 | 113/270 |

A diferença absoluta de accuracy foi de aproximadamente 21,48 pontos
percentuais em favor do BERTimbau.

O BERTimbau apresentou redução relativa de aproximadamente 51,33% no
número de erros em relação ao TF-IDF.

## Comparação pareada

- ambos erraram: 46
- somente BERTimbau errou: 9
- somente TF-IDF errou: 67
- discordâncias: 76

Teste exato de McNemar:

`p = 4.33435226414e-12`

A comparação pareada fornece evidência forte de desempenho superior do
BERTimbau neste conjunto independente.

## Recall por classe — BERTimbau

| Classe | Acertos | Recall |
|---|---:|---:|
| COBRADE_1_2_1_0_0 | 30/30 | 1.0000 |
| COBRADE_1_2_2_0_0 | 20/30 | 0.6667 |
| COBRADE_1_2_3_0_0 | 27/30 | 0.9000 |
| COBRADE_1_4_1_3_1 | 30/30 | 1.0000 |
| COBRADE_1_4_1_3_2 | 23/30 | 0.7667 |
| COBRADE_2_3_1_1_0 | 30/30 | 1.0000 |
| COBRADE_2_3_1_2_0 | 26/30 | 0.8667 |
| OTHER | 26/30 | 0.8667 |
| INSUFFICIENT_INFO | 3/30 | 0.1000 |

## Principais limitações observadas

### INSUFFICIENT_INFO

Foi a principal falha do modelo.

O BERTimbau classificou corretamente apenas 3 dos 30 exemplos.

O padrão indica tendência a atribuir uma classe específica mesmo quando o
texto não contém informação suficiente para distinguir semanticamente as
classes COBRADE consideradas.

### Enxurrada

O recall foi de 0.6667.

Foram observadas principalmente confusões entre enxurrada e inundação,
inclusive em textos com indícios de fluxo rápido, força da água e arraste.

### Incêndio florestal não protegido

O recall foi de 0.7667.

Foram observadas confusões sobretudo com incêndio florestal em área
protegida. A distinção exige reconhecer tanto o contexto da vegetação
quanto a ausência de unidade protegida e os reflexos de fumaça/qualidade
do ar.

## Comparação com o teste sintético

Os resultados no teste sintético v2 haviam sido aproximadamente:

- TF-IDF accuracy: 0.9956
- BERTimbau accuracy: 0.9941

No conjunto independente:

- TF-IDF accuracy: 0.5815
- BERTimbau accuracy: 0.7963

A queda demonstra que o teste sintético não era suficiente para estimar
a generalização para textos independentes.

## Seleção de modelo

Com base no desempenho global, macro-F1 e comparação pareada, o modelo
selecionado para a versão NLP v2 é:

`kamara_bertimbau_v2`

O TF-IDF permanece como baseline experimental.

## Uso operacional

O modelo NLP atua como mecanismo de pré-análise.

As previsões não constituem decisão final de classificação de uma
ocorrência. A decisão permanece submetida à validação humana.

A baixa capacidade de identificar `INSUFFICIENT_INFO` impede considerar
o modelo adequado para classificação autônoma.

## Validade do conjunto independente

Após esta avaliação, `independent_test_v1` deve ser considerado
consumido.

Os exemplos, rótulos ou critérios do conjunto não devem ser modificados
para melhorar os resultados desta versão.

Mudanças de treinamento, arquitetura, regras de decisão ou dados que
sejam motivadas pelos erros observados constituirão uma nova versão do
sistema e deverão ser avaliadas posteriormente em um novo conjunto
independente.

## Limitações do benchmark

- 270 exemplos é uma amostra relativamente pequena.
- O conjunto é artificialmente balanceado em 30 exemplos por classe.
- O balanceamento não representa prevalência real dos eventos.
- Grande parte dos textos foi extraída de fontes públicas institucionais.
- A linguagem dessas fontes pode diferir da linguagem de cidadãos no
  aplicativo.
- A avaliação mede generalização para este conjunto independente e não
  garante desempenho equivalente em produção.

### Distribuição dos erros do BERTimbau

Dos 55 erros do BERTimbau:

- 27 ocorreram em `INSUFFICIENT_INFO`;
- 10 em `COBRADE_1_2_2_0_0` — Enxurrada;
- 7 em `COBRADE_1_4_1_3_2` — incêndio florestal não protegido;
- 4 em `COBRADE_2_3_1_2_0` — incêndio em aglomerado residencial;
- 4 em `OTHER`;
- 3 em `COBRADE_1_2_3_0_0` — Alagamento.

Assim, aproximadamente 49% dos erros do modelo ocorreram somente em
`INSUFFICIENT_INFO`.

### Confiança das previsões incorretas

Foram observados erros com elevada confiança, incluindo previsões
incorretas acima de 0.90.

Isso indica que a probabilidade máxima produzida pelo classificador não
deve ser interpretada diretamente como uma medida calibrada de segurança
da decisão.

Consequentemente, um simples limiar de confiança não é suficiente, por si
só, para implementar uma estratégia confiável de abstention.

### Interpretação de INSUFFICIENT_INFO

Os erros sugerem que o modelo apresenta dificuldade em distinguir
insuficiência semântica de presença de vocabulário relacionado a uma
classe.

Diversos textos independentes descrevem eventos reais, porém sem os
elementos necessários para determinar a categoria COBRADE exata. Mesmo
nesses casos, o modelo frequentemente atribuiu uma classe específica.

Esse comportamento é compatível com possível diferença de distribuição
entre os exemplos sintéticos de `INSUFFICIENT_INFO` e os casos
independentes.

### Incêndio florestal não protegido

O recall foi de 0.7667.

Entre os sete erros observados, houve confusões com incêndio em aglomerado
residencial, incêndio florestal protegido e incêndio industrial.

A confusão mais frequente neste conjunto ocorreu com incêndio em
aglomerado residencial, especialmente quando fumaça ou vegetação estavam
próximas de moradias.