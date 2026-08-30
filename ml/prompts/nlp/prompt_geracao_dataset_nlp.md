# Prompt Final — Geração do Dataset Sintético NLP v1 do KAMARA

**Versão:** `kamara_nlp_generation_v1`  
**Idioma:** português brasileiro (`pt-BR`)  
**Finalidade:** geração controlada de dados sintéticos para treinamento de um classificador textual de ocorrências de desastres.

---

## 1. Papel do modelo gerador

Você deve gerar exemplos sintéticos de relatos de cidadãos para um dataset supervisionado de classificação textual de ocorrências.

Cada registro representa **uma descrição textual de uma ocorrência escrita por uma pessoa em um aplicativo móvel**.

Os textos devem ser linguisticamente variados e semanticamente corretos. Eles podem conter linguagem formal, informal, abreviações, gírias, erros ortográficos plausíveis, falta de acentos, ausência de pontuação, palavrões ocasionais, caixa alta, repetição de caracteres ou emojis ocasionais.

Essas variações devem reproduzir comportamentos linguísticos plausíveis e nunca devem ser usadas como marcadores artificiais de classe.

O classificador treinado com esses dados será usado apenas para **pré-análise**. A decisão final sobre a ocorrência será humana.

---

# 2. Parâmetros desta geração

Gere exatamente:

- quantidade: `[N]`
- classe-alvo: `[TARGET_LABEL]`
- código COBRADE: `[COBRADE_CODE]`
- nome da classe: `[TARGET_CLASS_NAME]`
- identificador do lote: `[BATCH_ID]`

Gere somente exemplos da classe solicitada neste lote.

Para `OTHER` e `INSUFFICIENT_INFO`, use `cobrade_code = null`.

---

# 3. Classes permitidas

O dataset possui exatamente nove classes.

## `COBRADE_1_2_1_0_0`

Código:

```text
1.2.1.0.0
```

Nome:

```text
Inundações
```

Caracterização operacional:

- transbordamento de curso d'água;
- elevação do nível de rio, igarapé, córrego ou equivalente;
- geralmente evolução gradual;
- água ultrapassando margens;
- avanço para áreas normalmente secas;
- comunidades ou residências ribeirinhas atingidas.

Não confundir com:

- enxurrada: fluxo rápido, súbito e energético;
- alagamento: água acumulada em contexto de drenagem urbana insuficiente.

---

## `COBRADE_1_2_2_0_0`

Código:

```text
1.2.2.0.0
```

Nome:

```text
Enxurradas
```

Caracterização operacional:

- escoamento superficial rápido;
- correnteza forte;
- alta energia;
- chegada repentina;
- fluxo capaz de arrastar veículos, pessoas, lama, pedras, galhos ou objetos;
- aumento brusco da vazão.

Não confundir com:

- cheia gradual de curso d'água;
- água acumulada ou relativamente parada em ruas.

---

## `COBRADE_1_2_3_0_0`

Código:

```text
1.2.3.0.0
```

Nome:

```text
Alagamentos
```

Caracterização operacional:

- acúmulo de água em ambiente predominantemente urbano;
- drenagem insuficiente ou sobrecarregada;
- bueiros sem vazão suficiente;
- ruas, avenidas ou cruzamentos cobertos por água;
- água permanecendo acumulada em pontos baixos.

Não confundir com:

- transbordamento de curso d'água;
- correnteza súbita e destrutiva.

---

## `COBRADE_1_4_1_3_1`

Código:

```text
1.4.1.3.1
```

Nome:

```text
Incêndio florestal - Incêndios em parques, áreas de proteção ambiental e áreas de preservação permanente
```

O texto deve sustentar simultaneamente:

1. incêndio em vegetação;
2. contexto explicitamente protegido.

Exemplos de contexto:

- unidade de conservação;
- área de proteção ambiental;
- APA;
- área de preservação permanente;
- APP;
- parque ambiental protegido;
- reserva explicitamente protegida.

Não invente status de proteção ambiental.

`"tem fogo na mata"` isoladamente não é suficiente para esta categoria exata.

---

## `COBRADE_1_4_1_3_2`

Código:

```text
1.4.1.3.2
```

Nome:

```text
Incêndio florestal - Incêndios em áreas não protegidas, com reflexos na qualidade do ar
```

O texto deve sustentar incêndio em vegetação não protegida ou em contexto claramente equivalente.

Contextos possíveis:

- pastagem;
- matagal;
- vegetação rural fora de unidade de conservação;
- área de vegetação não protegida;
- queimada com fumaça intensa;
- impacto perceptível da fumaça na região.

Não invente que a área é não protegida quando isso não puder ser sustentado pelo texto.

---

## `COBRADE_2_3_1_1_0`

Código:

```text
2.3.1.1.0
```

Nome:

```text
Incêndios em plantas e distritos industriais, parques e depósitos
```

O relato deve indicar incêndio em contexto industrial ou de armazenamento, como:

- fábrica;
- planta industrial;
- distrito industrial;
- parque industrial;
- depósito;
- armazém;
- galpão usado como depósito;
- instalação de armazenamento;
- complexo industrial.

---

## `COBRADE_2_3_1_2_0`

Código:

```text
2.3.1.2.0
```

Nome:

```text
Incêndios em aglomerados residenciais
```

O texto deve indicar incêndio em contexto de concentração de moradias, como:

- várias casas;
- conjunto de residências;
- aglomerado de moradias;
- comunidade densamente ocupada;
- conjunto habitacional;
- fogo se propagando entre moradias próximas.

`"uma casa pegou fogo"` isoladamente não é suficiente para esta categoria exata.

---

## `OTHER`

Use quando:

- existe um evento claramente identificável;
- esse evento está fora das sete categorias COBRADE contempladas nesta versão.

Exemplos possíveis:

- deslizamento;
- vendaval;
- granizo;
- seca;
- erosão;
- desabamento;
- outros desastres fora do escopo.

`OTHER` não significa falta de informação.

---

## `INSUFFICIENT_INFO`

Use quando não existe informação suficiente para selecionar uma categoria exata do escopo.

Exemplos:

```text
"tem mt agua aq"
```

```text
"tem muita fumaca perto das casa n sei de onde vem"
```

```text
"aconteceu alguma coisa aqui e precisamos de ajuda"
```

Também pertence a esta classe:

- risco futuro sem ocorrência atual;
- negação do evento;
- relato muito vago;
- fogo em vegetação sem informação suficiente para definir o tipo de área;
- água sem origem ou dinâmica suficiente;
- contexto conflitante sem evidência dominante.

Não invente detalhes ausentes.

---

# 4. Princípio de rotulagem

A classe deve depender do **significado global do relato**, nunca de uma única palavra.

Regras proibidas:

```text
"rio" → inundação
"correnteza" → enxurrada
"bueiro" → alagamento
"mata" → incêndio florestal
"casa" → incêndio residencial
"fumaça" → incêndio
```

Palavras podem ser evidências, mas não podem determinar a classe isoladamente.

---

# 5. Compartilhamento de vocabulário

Use vocabulário compartilhado entre classes sempre que semanticamente plausível.

Palavras como:

```text
água
agua
chuva
rio
margem
rua
avenida
fogo
fumaça
fumaca
casa
mata
```

devem aparecer em diferentes classes quando fizer sentido.

Exemplo:

```text
"o rio foi subindo durante horas e passou da margem"
→ inundação
```

```text
"o rio encheu de repente e uma correnteza forte arrastou carros"
→ enxurrada
```

```text
"a chuva encheu a rua e os bueiros não deram vazão"
→ alagamento
```

A diferença deve estar na semântica e dinâmica do fenômeno, não apenas nas palavras usadas.

---

# 6. Diversidade linguística obrigatória

Dentro do conjunto gerado para cada classe, distribua os exemplos aproximadamente entre estes perfis principais:

- `neutral`: 20%
- `formal`: 10%
- `informal`: 20%
- `chat_abbreviated`: 15%
- `slang`: 8%
- `typo_no_accents`: 10%
- `profanity_emotional`: 5%
- `indirect`: 7%
- `mixed_noisy`: 5%

As proporções são aproximadas e não precisam ser matematicamente perfeitas em lotes pequenos.

O perfil linguístico nunca deve ser associado exclusivamente a uma classe.

---

# 7. Linguagem informal e escrita móvel

Quando compatível com o perfil solicitado, podem aparecer abreviações como:

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

Gírias plausíveis podem incluir:

```text
mano
vei
cara
deu ruim
ta feio
```

Exemplos de linguagem informal plausível:

```text
"mano o rio ta subindo faz horas e ja passou da margem"
```

```text
"a rua ta toda cheia d agua pq os bueiro n tao dando conta"
```

```text
"pqp a agua veio mt rapido e levou uma moto"
```

O uso dessas formas deve parecer natural, não produzido mecanicamente.

---

# 8. Palavrões

Palavrões podem aparecer ocasionalmente como expressão de medo, urgência, frustração ou estresse.

Exemplos plausíveis:

```text
"pqp a agua ja entrou aqui"
```

```text
"ta pegando fogo pra caralho aqui perto"
```

Regras:

- não censurar palavrões dentro do texto bruto;
- não usar palavrões em excesso;
- não associar palavrões a uma classe específica;
- palavrão não altera o rótulo;
- o significado do evento continua sendo o fator determinante.

---

# 9. Erros, abreviações e ruído linguístico

São permitidos, de forma controlada:

- ausência de acentos;
- erros ortográficos comuns;
- ausência de pontuação;
- abreviações;
- gramática informal;
- caixa alta;
- repetição de caracteres;
- emojis ocasionais;
- gírias;
- palavrões.

Exemplos:

```text
"ta saindo muita fumasa"
```

```text
"A AGUA TA ENTRANDO NAS CASA"
```

```text
"ta subindo muitoooo rapido"
```

```text
"🔥 tem fogo no mato perto daqui"
```

Não produzir:

- caracteres aleatórios;
- erros em quase todas as palavras;
- abreviações inventadas sem uso plausível;
- sequências incompreensíveis;
- excesso de emojis;
- ruído que destrua o significado.

---

# 10. Texto informal não significa informação insuficiente

Exemplo:

```text
"mano o rio ta subindo faz horas e ja passou da margem"
```

Pode conter evidência suficiente para inundação.

Exemplo:

```text
"pqp a agua veio mt rapido e levou uma moto"
```

Pode conter evidência suficiente para enxurrada.

Exemplo:

```text
"a rua ta cheia d agua pq os bueiro n tao dando conta"
```

Pode conter evidência suficiente para alagamento.

Por outro lado:

```text
"tem mt agua aq"
```

não contém informação suficiente para definir a categoria exata.

---

# 11. Dificuldade

Distribua aproximadamente:

- `typical`: 50%
- `intermediate`: 30%
- `hard`: 20%

## `typical`

A classe é claramente sustentada pelo conteúdo.

## `intermediate`

O fenômeno continua identificável, mas:

- é descrito indiretamente;
- há detalhes secundários;
- o vocabulário é menos canônico;
- a estrutura é menos previsível.

## `hard`

Pode conter:

- vocabulário compartilhado com outras classes;
- detalhes distratores;
- linguagem ruidosa;
- incerteza moderada;
- temporalidade;
- negação parcial;
- caso semanticamente próximo de outra classe.

Mesmo em `hard`, o rótulo deve permanecer justificável.

Se o rótulo não puder ser defendido pelas informações presentes, não force a classe.

---

# 12. Casos que precisam aparecer no dataset

Ao longo dos lotes de cada classe, inclua diversidade de:

- textos curtos;
- textos médios;
- textos mais detalhados;
- descrições diretas;
- descrições indiretas;
- causa antes do efeito;
- efeito antes da causa;
- referências genéricas de localização;
- diferentes momentos do dia;
- pedidos de ajuda;
- relatos emocionais;
- relatos neutros;
- relatos com detalhes irrelevantes;
- escrita de celular.

---

# 13. Casos de fronteira

Os exemplos difíceis devem representar fronteiras reais.

## Inundação × enxurrada

Inundação:

```text
"o nivel do rio foi subindo durante horas ate passar da margem"
```

Enxurrada:

```text
"a agua chegou de repente com muita força e arrastou um carro"
```

## Inundação × alagamento

Inundação:

```text
"a agua do rio passou da margem e entrou nas ruas do bairro"
```

Alagamento:

```text
"os bueiros n deram conta e a agua ficou acumulada na avenida"
```

## Enxurrada × alagamento

Enxurrada:

```text
"a agua desceu muito rapido pela rua levando lixo e motos"
```

Alagamento:

```text
"a rua ficou coberta de agua e quase n ta escoando"
```

## Incêndio protegido × não protegido

Não inventar proteção ambiental.

## Incêndio florestal × residencial

```text
"tem fogo perto das casas"
```

isoladamente pode ser insuficiente.

## Incêndio residencial

Não transformar qualquer incêndio em uma única casa automaticamente em incêndio em aglomerado residencial.

---

# 14. Negação, risco futuro e incerteza

A presença de palavras relacionadas ao desastre não significa que o evento ocorreu.

Exemplos:

```text
"o rio ta alto mas ainda n passou da margem"
```

```text
"se chover mais essa rua pode alagar"
```

```text
"n tem incendio a fumaca vem de uma churrasqueira"
```

```text
"tem fumaca aq mas n sei se vem do mato ou das casa"
```

Quando não existir evento atual suficientemente classificável, use `INSUFFICIENT_INFO`.

---

# 15. Termo canônico da classe

Para as sete classes COBRADE:

- pelo menos 60% dos exemplos não devem conter o nome canônico da categoria;
- não repetir mecanicamente nomes oficiais;
- nunca colocar o código COBRADE dentro do campo `text`.

O objetivo é evitar um classificador baseado apenas em palavras-chave.

---

# 16. Não produzir templates repetitivos

É proibido gerar séries como:

```text
"O rio transbordou na rua A."
"O rio transbordou na rua B."
"O rio transbordou na rua C."
```

ou:

```text
"Há um incêndio em..."
"Há um incêndio em..."
"Há um incêndio em..."
```

Varie:

- ordem dos constituintes;
- tamanho;
- vocabulário;
- construção sintática;
- nível de detalhe;
- ponto de vista;
- temporalidade;
- estilo;
- tipo de evidência.

Não gere paráfrases superficiais da mesma frase.

---

# 17. Privacidade

Não utilize dados pessoais reais.

Não gerar:

- CPF;
- RG;
- telefone;
- e-mail;
- endereço residencial real;
- nomes completos de pessoas reais;
- outros identificadores pessoais.

Localizações devem ser genéricas ou fictícias.

---

# 18. Metadados da saída

Cada registro deve conter:

```text
text
target_label
cobrade_code
scenario_family
linguistic_profile
noise_features
difficulty
```

## `scenario_family`

Use um identificador curto em `snake_case` descrevendo o cenário.

Exemplos:

```text
gradual_river_overflow
rapid_water_flow
urban_drainage_failure
protected_area_fire
industrial_storage_fire
residential_fire_spread
vague_water_report
```

Esse campo é metadado e não será usado como entrada do classificador.

## `noise_features`

Lista contendo zero ou mais valores:

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

Use somente características realmente presentes no texto.

---

# 19. Formato de saída

Responda somente com JSONL válido.

Não use Markdown.

Não escreva explicações.

Não escreva texto antes ou depois dos registros.

Cada linha deve seguir este formato:

```json
{"text":"texto bruto","target_label":"[TARGET_LABEL]","cobrade_code":"[COBRADE_CODE]","scenario_family":"cenario","linguistic_profile":"perfil","noise_features":[],"difficulty":"typical"}
```

Para `OTHER` e `INSUFFICIENT_INFO`:

```json
"cobrade_code": null
```

e não:

```json
"cobrade_code": "null"
```

---

# 20. Autochecagem obrigatória

Antes da resposta, revise internamente todos os registros.

Confirme:

1. foram gerados exatamente `[N]` registros;
2. todos pertencem à classe solicitada;
3. todos os rótulos são semanticamente defensáveis;
4. nenhum código COBRADE aparece no campo `text`;
5. não existem duplicatas exatas;
6. não existem grupos grandes de paráfrases quase idênticas;
7. não existe padrão sintático dominante;
8. a linguagem informal é plausível;
9. erros ortográficos não tornam o texto incompreensível;
10. palavrões são ocasionais;
11. emojis são ocasionais;
12. `noise_features` corresponde ao texto;
13. a dificuldade está coerente;
14. exemplos `hard` continuam rotuláveis;
15. não foram inventadas informações necessárias para justificar a classe;
16. casos insuficientes não foram forçados para classes COBRADE;
17. o código COBRADE está correto;
18. todas as linhas são JSON válido.

Se qualquer registro falhar, substitua-o antes de responder.

Retorne somente o JSONL final.
