# 02 — Regras Semânticas COBRADE para o Dataset NLP

## 1. Objetivo

Este documento define as regras semânticas utilizadas para gerar, revisar e rotular os exemplos do dataset NLP v1 do KAMARA.

As regras têm três funções:

1. impedir que a LLM gere exemplos semanticamente inconsistentes;
2. reduzir confusões artificiais entre classes próximas;
3. garantir que uma classe COBRADE exata somente seja atribuída quando o texto contiver evidência suficiente.

As regras abaixo não substituem a documentação oficial da COBRADE. Elas funcionam como **critérios operacionais de anotação do dataset**.

---

## 2. Princípio central de rotulagem

A classe deve ser determinada pelo **significado global do relato**, e não por uma palavra isolada.

Exemplo inadequado:

```text
Se contém "água" → alagamento
```

Exemplo inadequado:

```text
Se contém "fumaça" → incêndio florestal
```

O rótulo deve depender de elementos como:

- origem do fenômeno;
- dinâmica do evento;
- ambiente afetado;
- velocidade ou forma de ocorrência;
- contexto urbano, fluvial, ambiental, industrial ou residencial;
- presença ou ausência de informações necessárias para distinguir classes próximas.

Quando o texto não sustentar uma categoria exata, deve ser utilizado `INSUFFICIENT_INFO` em vez de inventar detalhes.

---

# 3. Classes hidrológicas

As três classes hidrológicas são semanticamente próximas e devem receber atenção especial.

A documentação oficial COBRADE diferencia os fenômenos principalmente por:

```text
INUNDAÇÃO
transbordamento gradual de curso d'água

ENXURRADA
escoamento superficial rápido, energético e súbito

ALAGAMENTO
capacidade de drenagem urbana excedida e água acumulada
```

---

## 3.1 COBRADE 1.2.1.0.0 — Inundações

### Caracterização

A COBRADE caracteriza inundação como submersão de áreas fora dos limites normais de um curso de água, normalmente por transbordamento gradual.

### Evidências favoráveis

O texto pode indicar:

- rio, igarapé, córrego ou outro curso d'água;
- subida gradual do nível;
- transbordamento das margens;
- cheia;
- avanço da água para áreas normalmente secas;
- comunidades ribeirinhas atingidas;
- casas próximas ao rio invadidas pela água;
- chuvas prolongadas associadas à elevação de rios.

### Exemplos semanticamente compatíveis

```text
"O rio subiu durante vários dias e transbordou, atingindo as casas próximas às margens."
```

```text
"A cheia avançou lentamente sobre a comunidade ribeirinha."
```

### Não é evidência suficiente

```text
"Choveu muito e tem água na rua."
```

Não há informação suficiente sobre curso d'água e transbordamento.

### Confusão principal: alagamento

```text
"A avenida ficou cheia de água depois da chuva."
```

Sem referência a transbordamento de um curso d'água, o texto não deve ser classificado como inundação apenas pelo volume de água.

### Confusão principal: enxurrada

A presença de:

```text
correnteza forte
alta velocidade
chegada súbita
arraste de veículos ou detritos
```

favorece `ENXURRADA`, e não `INUNDAÇÃO`.

---

## 3.2 COBRADE 1.2.2.0.0 — Enxurradas

### Caracterização

A COBRADE define enxurrada como escoamento superficial de alta velocidade e energia, provocado tipicamente por chuvas intensas e concentradas, podendo envolver elevação súbita de vazões e transbordamento brusco.

### Evidências favoráveis

- correnteza muito forte;
- água em alta velocidade;
- chegada repentina do fluxo;
- fluxo destrutivo;
- arraste de carros, pessoas, pedras, lama ou detritos;
- forte energia da água;
- transbordamento brusco;
- pequena bacia ou relevo acidentado quando explicitamente mencionado.

### Exemplos semanticamente compatíveis

```text
"Depois da chuva intensa, uma correnteza muito forte desceu pela rua e arrastou dois carros."
```

```text
"A água chegou de repente com muita força, levando pedras e entulho."
```

### Não é evidência suficiente

```text
"A rua está cheia de água."
```

Isso descreve presença de água, mas não velocidade ou energia do escoamento.

### Confusão principal: inundação

```text
"O rio subiu durante dias e lentamente alcançou as casas."
```

Esse comportamento gradual favorece inundação.

### Confusão principal: alagamento

```text
"A água ficou acumulada no cruzamento porque os bueiros não deram vazão."
```

Esse contexto favorece alagamento.

---

## 3.3 COBRADE 1.2.3.0.0 — Alagamentos

### Caracterização

A COBRADE caracteriza alagamento pela extrapolação da capacidade dos sistemas de drenagem urbana, provocando acúmulo de água em ruas, calçadas ou outras infraestruturas urbanas.

### Evidências favoráveis

- água acumulada em rua ou avenida;
- bueiros sem capacidade de escoamento;
- drenagem urbana sobrecarregada;
- água parada ou com escoamento insuficiente;
- cruzamentos tomados por água;
- pontos baixos urbanos;
- chuva intensa associada ao acúmulo urbano.

### Exemplos semanticamente compatíveis

```text
"Depois da chuva forte, a água ficou acumulada na avenida porque os bueiros não conseguiram escoar."
```

```text
"O cruzamento ficou tomado por água e o trânsito parou."
```

### Não é evidência suficiente

```text
"O rio transbordou e invadiu as casas."
```

Isso favorece inundação.

### Confusão principal: enxurrada

Água em movimento violento ou arrastando objetos favorece enxurrada. Água acumulada em infraestrutura urbana favorece alagamento.

---

# 4. Incêndios florestais

## 4.1 COBRADE 1.4.1.3.1 — Incêndios em áreas protegidas

Nome utilizado pelo sistema:

```text
Incêndio florestal - Incêndios em parques, áreas de proteção ambiental e áreas de preservação permanente
```

### Evidências favoráveis

O texto deve sustentar simultaneamente:

1. existência de incêndio/fogo em vegetação; e
2. contexto de área ambiental protegida.

Indicadores de contexto:

- parque protegido;
- unidade de conservação;
- área de proteção ambiental;
- APA;
- área de preservação permanente;
- APP;
- reserva ou área protegida, quando o texto deixar claro seu status.

### Exemplos compatíveis

```text
"Um incêndio está atingindo a vegetação dentro de uma unidade de conservação."
```

```text
"As chamas avançaram por uma área de preservação permanente."
```

### Não classificar automaticamente

```text
"Há fogo na mata."
```

Falta informação para saber se a área é protegida.

Esse exemplo deve ser tratado como `INSUFFICIENT_INFO` para uma COBRADE exata, e não forçado para `1.4.1.3.1`.

---

## 4.2 COBRADE 1.4.1.3.2 — Incêndios em áreas não protegidas, com reflexos na qualidade do ar

### Evidências favoráveis

O relato deve sustentar:

- incêndio em vegetação;
- contexto fora de área protegida ou contexto claramente compatível com vegetação não protegida;
- preferencialmente indícios de fumaça intensa ou impacto na qualidade do ar, coerentes com a própria descrição da categoria COBRADE.

Exemplos de contexto:

- pastagem;
- vegetação rural fora de unidade de conservação;
- matagal;
- área de vegetação não protegida;
- fumaça intensa afetando a região.

### Exemplos compatíveis

```text
"Uma grande área de pastagem está queimando e a fumaça tomou a comunidade próxima."
```

```text
"O fogo se espalhou pela vegetação fora da área de conservação e está produzindo muita fumaça."
```

### Não classificar automaticamente

```text
"Tem fumaça vindo da mata."
```

Não há informação suficiente sobre:

- existência confirmada de incêndio;
- tipo de área;
- proteção ambiental;
- contexto necessário para a categoria exata.

---

# 5. Incêndios urbanos

## 5.1 COBRADE 2.3.1.1.0 — Incêndios em plantas e distritos industriais, parques e depósitos

### Evidências favoráveis

O texto deve indicar incêndio em contexto como:

- planta industrial;
- fábrica;
- distrito industrial;
- parque industrial;
- depósito;
- armazém;
- instalação de armazenamento;
- complexo industrial.

### Exemplos compatíveis

```text
"Um incêndio de grandes proporções atingiu um depósito no distrito industrial."
```

```text
"As chamas estão se espalhando dentro de uma planta industrial."
```

### Casos que não pertencem à classe

```text
"Uma casa está pegando fogo."
```

```text
"Há fogo em uma área de mata."
```

---

## 5.2 COBRADE 2.3.1.2.0 — Incêndios em aglomerados residenciais

### Evidências favoráveis

O texto deve fornecer contexto de aglomeração ou concentração residencial, por exemplo:

- conjunto de residências;
- várias casas atingidas;
- comunidade densamente ocupada;
- aglomerado de moradias;
- conjunto habitacional;
- fogo se propagando entre edificações residenciais próximas.

### Exemplos compatíveis

```text
"O incêndio se espalhou entre várias casas de uma comunidade."
```

```text
"As chamas atingiram diversas moradias próximas umas das outras."
```

### Atenção: residência isolada

```text
"Uma casa pegou fogo."
```

Esse texto, isoladamente, não fornece evidência suficiente para afirmar a categoria específica `Incêndios em aglomerados residenciais`.

No dataset v1 ele deve ser considerado um caso de informação insuficiente para a categoria exata, salvo quando houver contexto adicional que estabeleça o caráter de aglomerado residencial.

Essa regra evita ensinar o modelo a transformar automaticamente:

```text
casa → 2.3.1.2.0
```

---

# 6. Classe OTHER

## Definição

`OTHER` deve ser utilizada quando o texto descreve um evento suficientemente identificável, porém esse evento está fora das sete categorias do NLP v1.

Exemplos possíveis:

```text
"Uma encosta deslizou e bloqueou a estrada."
```

```text
"Uma tempestade de granizo danificou vários telhados."
```

```text
"Fortes rajadas de vento derrubaram árvores."
```

### Regra importante

`OTHER` não significa:

```text
"não sei qual é a classe"
```

Ele significa:

```text
"há informação suficiente e o evento está fora do escopo v1"
```

---

# 7. Classe INSUFFICIENT_INFO

## Definição

`INSUFFICIENT_INFO` deve ser utilizada quando o relato não contém evidência suficiente para escolher uma categoria exata do escopo.

Exemplos:

```text
"Está acontecendo alguma coisa grave aqui."
```

```text
"Tem muita água, mas não sei de onde está vindo."
```

```text
"Há fumaça perto das casas."
```

Também inclui casos em que o evento está relacionado ao escopo, mas falta uma característica discriminante.

Exemplo:

```text
"Há fogo na vegetação."
```

O texto não informa se a área é protegida ou não protegida.

---

# 8. Negação, hipótese e temporalidade

A presença de uma palavra associada ao desastre não implica que o desastre esteja ocorrendo.

### Negação

```text
"A rua não está alagada."
```

Não deve ser rotulada como `ALAGAMENTO`.

```text
"Não há incêndio, a fumaça vem de uma churrasqueira."
```

Não deve ser rotulada como incêndio.

### Hipótese ou risco futuro

```text
"O rio pode transbordar se continuar chovendo."
```

Isso descreve risco, não uma inundação confirmada.

```text
"A vegetação está seca e pode pegar fogo."
```

Isso descreve possibilidade futura.

Na tarefa atual, casos puramente hipotéticos devem tender a `INSUFFICIENT_INFO`, porque o objetivo é classificar ocorrências descritas, não prever risco futuro.

### Evento passado encerrado

```text
"Ontem houve um incêndio, mas ele já foi completamente controlado."
```

Esses casos devem ser marcados como difíceis e tratados de forma consistente durante a construção do dataset. Eles não devem aparecer apenas em uma classe.

---

# 9. Ambiguidade controlada

Alguns textos podem conter vocabulário de mais de uma classe.

Exemplo:

```text
"O rio transbordou e a água correu forte pelas ruas."
```

O texto possui:

- transbordamento fluvial;
- escoamento forte.

Nesse caso, a LLM geradora não deve escolher arbitrariamente a classe.

Durante a geração, exemplos propositalmente limítrofes devem:

- conter informação suficiente para uma classe dominante; ou
- ser rotulados como `INSUFFICIENT_INFO` quando a distinção não for justificável.

Não serão mantidos exemplos cujo rótulo dependa apenas de uma interpretação arbitrária do gerador.

---

# 10. Regras contra vazamento semântico

A geração deve obedecer às seguintes regras:

1. O código COBRADE nunca deve aparecer no campo `text`.
2. O nome oficial completo da classe não deve ser repetido mecanicamente.
3. Uma parcela relevante dos exemplos deve evitar o termo canônico da classe.
4. O rótulo não deve ser inferível apenas pela estrutura da frase.
5. Localidade, tamanho do texto, estilo ou pontuação não podem funcionar como identificadores artificiais de classe.
6. As mesmas formas linguísticas devem aparecer em classes diferentes.
7. Termos compartilhados como `água`, `chuva`, `fogo` e `fumaça` devem ocorrer em múltiplos contextos.
8. Classes negativas e casos insuficientes devem conter vocabulário parecido com as classes positivas.

---

# 11. Matriz resumida de distinção

| Classe | Evidência central | Principal confusão |
|---|---|---|
| Inundações | curso d'água + transbordamento gradual | enxurrada / alagamento |
| Enxurradas | fluxo rápido + alta energia + caráter súbito | inundação / alagamento |
| Alagamentos | drenagem urbana excedida + acúmulo em infraestrutura urbana | inundação / enxurrada |
| Incêndio florestal protegido | fogo em vegetação + área protegida | incêndio florestal não protegido |
| Incêndio florestal não protegido | fogo em vegetação não protegida + contexto compatível com impacto de fumaça/ar | área protegida / incêndio urbano |
| Incêndio industrial/depósito | fogo + instalação industrial/armazenamento | incêndio residencial |
| Incêndio em aglomerado residencial | fogo + múltiplas moradias/aglomeração residencial | residência isolada / incêndio industrial |
| OTHER | evento identificável fora do escopo | insuficiência de informação |
| INSUFFICIENT_INFO | falta de evidência para classe exata | qualquer classe do escopo |

---

# 12. Critérios de revisão semântica

Um exemplo deve ser rejeitado ou revisado quando:

- o rótulo contradiz o texto;
- faltam características necessárias para a categoria exata;
- depende somente do nome explícito da classe;
- contém duas classes sem dominância justificável;
- inventa status de área protegida;
- transforma qualquer incêndio residencial isolado em aglomerado residencial;
- transforma qualquer água urbana em alagamento sem contexto;
- transforma qualquer transbordamento em enxurrada;
- transforma qualquer fumaça em incêndio florestal;
- contém informações tecnicamente incompatíveis;
- foi rotulado por associação lexical simples.

---

# 13. Fontes de domínio

As definições hidrológicas e a nomenclatura das categorias utilizadas nesta especificação são fundamentadas na Classificação e Codificação Brasileira de Desastres — COBRADE, publicada pelo Ministério da Integração e do Desenvolvimento Regional.

A documentação oficial distingue:

- inundação: transbordamento gradual de curso d'água;
- enxurrada: escoamento superficial de alta velocidade e energia;
- alagamento: extrapolação da capacidade de drenagem urbana e acúmulo de água.

Para incêndios, são utilizados os nomes e códigos oficiais das quatro categorias selecionadas no escopo NLP v1.

---

## Referências

- Ministério da Integração e do Desenvolvimento Regional. *Classificação e Codificação Brasileira de Desastres — COBRADE*.
- Ministério da Integração e do Desenvolvimento Regional. Material institucional sobre diferenças entre desastres naturais e tecnológicos registrados no Brasil.
