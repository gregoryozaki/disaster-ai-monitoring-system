# 03 — Plano de Diversidade Linguística e Casos Difíceis

**Versão:** 2.0  
**Escopo:** Dataset sintético NLP v1 do KAMARA

## 1. Objetivo

Este documento define como a diversidade linguística e os casos difíceis serão planejados na geração sintética do dataset NLP v1 do KAMARA.

No contexto textual, a robustez do dataset depende de representar não apenas descrições formais e bem escritas, mas também a forma como cidadãos podem realmente escrever em um aplicativo móvel durante uma situação de estresse.

Por isso, a diversidade deve contemplar:

- português formal e neutro;
- linguagem informal;
- abreviações comuns de chat;
- ausência de acentuação;
- erros ortográficos plausíveis;
- gírias;
- palavrões ocasionais;
- ausência de pontuação;
- caixa alta;
- repetição de caracteres;
- emojis ocasionais;
- incerteza;
- negação;
- temporalidade;
- descrições indiretas;
- casos semanticamente próximos entre classes.

Esses fenômenos não são tratados como “anomalias artificiais”. Eles representam variação linguística plausível do canal de entrada.

---

## 2. Princípio metodológico

O dataset não deve produzir apenas exemplos limpos e canônicos como:

```text
"Há um alagamento na avenida."
```

ou:

```text
"O rio transbordou e provocou uma inundação."
```

Na prática, podem existir relatos como:

```text
"a rua ta toda cheia d agua aq"
```

```text
"mano o rio ta subindo faz horas e ja passou da margem"
```

```text
"pqp a agua veio descendo com força e levou uma moto"
```

```text
"tem mt fumaca aq n sei da onde vem"
```

O objetivo do modelo deve ser aprender o fenômeno semântico descrito, e não o estilo superficial do usuário.

---

## 3. Dimensões de diversidade

A diversidade deve ocorrer em três dimensões:

```text
conteúdo semântico
+
forma linguística
+
grau de dificuldade
```

Nenhuma dessas dimensões deve funcionar como atalho artificial para a classe.

---

## 4. Perfis linguísticos

Cada registro sintético deverá conter o campo:

```text
linguistic_profile
```

Valores planejados:

```text
formal
neutral
informal
chat_abbreviated
slang
typo
no_accents
profanity_emotional
all_caps
repeated_characters
emoji_light
indirect
uncertain
mixed_noisy
```

### 4.1 `formal`

Exemplo:

```text
"O nível do rio ultrapassou gradualmente as margens e atingiu residências próximas."
```

### 4.2 `neutral`

Exemplo:

```text
"O rio foi subindo e a água entrou nas casas perto da margem."
```

### 4.3 `informal`

Exemplo:

```text
"O rio encheu demais e a água já entrou nas casas daqui."
```

### 4.4 `chat_abbreviated`

Pode conter abreviações comuns de escrita em celular, como:

```text
vc
vcs
pq
q
n
nao
tb
tmb
aq
aki
agr
mt
mto
ta
to
```

Exemplo:

```text
"o rio ta subindo mt e ja passou da margem aq"
```

### 4.5 `slang`

Pode conter gírias plausíveis, por exemplo:

```text
mano
vei
cara
deu ruim
ta feio
```

Exemplo:

```text
"mano deu ruim aqui o rio passou da margem e a agua ta entrando nas casa"
```

### 4.6 `typo`

Erros ortográficos devem ser plausíveis e limitados.

Exemplo:

```text
"ta saindo muita fumasa perto das casa"
```

Não gerar caracteres aleatórios ou texto ilegível.

### 4.7 `no_accents`

Exemplo:

```text
"a agua do rio passou da margem e entrou nas casas"
```

### 4.8 `profanity_emotional`

Palavrões podem aparecer ocasionalmente como expressão de estresse.

Exemplos:

```text
"pqp a agua ja entrou aqui em casa"
```

```text
"ta pegando fogo pra caralho aqui perto"
```

Palavrões não devem ser censurados ou removidos apenas por serem palavrões.

Entretanto, eles nunca podem funcionar como marcador de uma classe específica.

### 4.9 `all_caps`

Exemplo:

```text
"A AGUA TA SUBINDO MUITO E JA PASSOU DA MARGEM"
```

### 4.10 `repeated_characters`

Exemplo:

```text
"a agua ta subindo muitoooo rapido"
```

### 4.11 `emoji_light`

Emojis podem ocorrer ocasionalmente e com baixa frequência.

Exemplos:

```text
"🔥 tem fogo no mato perto daqui"
```

```text
"rua toda cheia de agua 😭"
```

Não exagerar no uso de emojis.

### 4.12 `indirect`

O fenômeno é descrito sem usar o nome canônico da classe.

Exemplo:

```text
"os bueiros não estão dando conta e a avenida ficou toda coberta de água"
```

### 4.13 `uncertain`

Exemplo:

```text
"acho q o rio passou da margem mas daqui n da pra ver direito"
```

### 4.14 `mixed_noisy`

Combina mais de um fenômeno linguístico plausível.

Exemplo:

```text
"mano ta vindo agua mt rapido aq pqp levou uma moto ja"
```

---

## 5. Características de ruído linguístico

Um registro pode possuir várias características simultâneas.

Por isso, além de `linguistic_profile`, o dataset deve conter:

```text
noise_features
```

O campo deve ser uma lista de zero ou mais valores, por exemplo:

```json
[
  "abbreviation",
  "no_accents",
  "missing_punctuation"
]
```

Valores iniciais permitidos:

```text
abbreviation
slang
typo
no_accents
missing_punctuation
all_caps
repeated_characters
profanity
emoji
informal_grammar
```

Um texto formal e limpo pode usar:

```json
[]
```

---

## 6. Regras de distribuição

Nenhuma classe deve possuir um estilo linguístico exclusivo.

Exemplo proibido:

```text
alagamento → sempre informal
incêndio industrial → sempre formal
inundação → sempre sem erros
```

Os principais perfis devem aparecer transversalmente entre as classes.

A distribuição não precisa ser matematicamente idêntica, mas deve evitar correlação espúria entre estilo e classe.

---

## 7. Distribuição inicial recomendada para o piloto

Para cada grupo de aproximadamente 30 exemplos por classe:

```text
8 a 10  neutral/formal
6 a 8   informal
3 a 5   chat_abbreviated
2 a 4   typo/no_accents
1 a 3   slang
1 a 2   profanity_emotional
2 a 4   indirect/hard
```

Essas categorias podem se sobrepor. Portanto, os números são orientativos e não devem ser somados como partições rígidas.

O piloto servirá para recalibrar essa distribuição.

---

## 8. Dificuldade semântica

Cada registro deve possuir:

```text
difficulty
```

Valores:

```text
typical
intermediate
hard
```

### `typical`

A classe é clara e semanticamente sustentada.

### `intermediate`

A classe permanece justificável, mas os sinais são menos explícitos ou existem detalhes secundários.

### `hard`

Pode conter:

- vocabulário compartilhado;
- distrações;
- linguagem ruidosa;
- incerteza moderada;
- temporalidade;
- negação parcial;
- proximidade com outra classe.

Mesmo em `hard`, o rótulo deve continuar defensável.

---

## 9. Casos semanticamente difíceis

### 9.1 Negação

```text
"a rua n ta alagada a agua ja foi embora"
```

Não deve ser rotulado como alagamento.

```text
"n tem incendio a fumaca vem de uma churrasqueira"
```

Não deve ser rotulado como incêndio.

### 9.2 Risco futuro

```text
"se continuar chovendo o rio pode passar da margem"
```

Descreve risco, não ocorrência confirmada.

### 9.3 Incerteza

```text
"tem muita fumaca aq n sei se e do mato ou de alguma casa"
```

Pode ser `INSUFFICIENT_INFO`.

### 9.4 Evento passado

```text
"ontem o rio passou da margem mas a agua ja baixou"
```

A temporalidade deve ser tratada de forma consistente e não aparecer apenas em uma classe.

---

## 10. Vocabulário compartilhado

Palavras como:

```text
água
agua
chuva
rio
rua
fogo
fumaca
fumaça
casa
mata
```

devem aparecer em diferentes classes quando semanticamente plausível.

Objetivo:

```text
evitar palavra-chave → classe
```

Exemplos:

```text
"o rio foi subindo e passou da margem"
→ inundação
```

```text
"a agua veio descendo com força e levou uma moto"
→ enxurrada
```

```text
"os bueiro n tao dando conta e a rua ta toda cheia d agua"
→ alagamento
```

---

## 11. Distinção entre informação ruidosa e informação insuficiente

Texto informal não significa informação insuficiente.

Exemplo:

```text
"mano o rio ta subindo faz horas e ja passou da margem"
```

Apesar do estilo informal, há evidência suficiente para inundação.

Exemplo:

```text
"tem mt agua aq"
```

Não há evidência suficiente para distinguir a origem e a dinâmica da água.

Deve tender a:

```text
INSUFFICIENT_INFO
```

---

## 12. Preservação do texto bruto

A coluna:

```text
text
```

deve preservar a forma gerada e aprovada.

Não corrigir automaticamente:

- `vc` para `você`;
- `pq` para `porque`;
- `n` para `não`;
- ausência de acentos;
- gírias;
- palavrões;
- emojis;
- repetições;
- caixa alta.

Qualquer normalização posterior deverá ser uma decisão explícita da etapa de modelagem e jamais alterar o dataset bruto silenciosamente.

---

## 13. Regras contra ruído artificial

Não gerar:

- caracteres aleatórios sem função linguística;
- erros em todas as palavras;
- sequências incompreensíveis;
- palavrões em excesso;
- emojis em excesso;
- abreviações inventadas e improváveis;
- erros artificiais que destruam a semântica.

O texto deve continuar plausível como relato de uma pessoa.

---

## 14. Distinções hidrológicas

### Inundação × enxurrada

```text
"rio subindo há horas e passou da margem"
→ inundação
```

```text
"agua veio de uma vez com força e arrastou carro"
→ enxurrada
```

### Inundação × alagamento

```text
"rio passou da margem e entrou no bairro"
→ inundação
```

```text
"bueiro n da conta e a rua ficou toda coberta"
→ alagamento
```

### Enxurrada × alagamento

```text
"correnteza desceu rapido e levou lixo e moto"
→ enxurrada
```

```text
"agua ficou acumulada na avenida"
→ alagamento
```

---

## 15. Distinções entre incêndios

### Protegido × não protegido

```text
"fogo dentro de uma unidade de conservação"
→ área protegida
```

```text
"queimada em pastagem fora de área protegida com muita fumaça"
→ área não protegida
```

### Florestal × residencial

```text
"fogo no mato perto das casas"
→ incêndio florestal, se o contexto específico for suficiente
```

```text
"fogo passando de uma casa pra outra na comunidade"
→ aglomerado residencial
```

### Caso insuficiente

```text
"tem fogo perto das casa"
```

Pode ser `INSUFFICIENT_INFO`.

---

## 16. Distratores

Podem aparecer:

- trânsito;
- horário;
- presença de equipes;
- medo;
- pedido de ajuda;
- energia elétrica;
- ruído;
- dificuldade de acesso;
- clima;
- emoção.

Eles devem ser distribuídos entre classes.

---

## 17. Geração em lotes

Cada lote terá metadados explícitos:

```text
generation_batch
prompt_version
generator_model
scenario_family
linguistic_profile
noise_features
difficulty
```

Os lotes não devem ser definidos por template textual, e sim por objetivo semântico e linguístico.

---

## 18. Critérios para aprovar o piloto

O piloto só será aprovado se:

- as classes estiverem semanticamente corretas;
- textos informais continuarem classificáveis;
- gírias e abreviações não virarem atalhos de classe;
- palavrões forem ocasionais e transversalmente distribuídos;
- houver exemplos sem acentos e com erros plausíveis;
- os textos continuarem compreensíveis;
- não houver muitas paráfrases superficiais;
- casos difíceis forem realmente difíceis, mas defensáveis;
- `OTHER` e `INSUFFICIENT_INFO` permanecerem distintos;
- as classes hidrológicas continuarem semanticamente separáveis;
- os incêndios não forem determinados apenas por `fogo` ou `fumaça`.

---

## 19. Risco metodológico

Mesmo com LLM e diversidade planejada, o dataset poderá conter assinatura de geração.

Por isso, a avaliação futura deverá observar:

```text
qualidade semântica
+
similaridade entre exemplos
+
padrões lexicais por classe
+
generalização em conjunto independente
```

O desempenho em dados sintéticos gerados pelo mesmo processo não será interpretado isoladamente como evidência de desempenho em relatos reais.
