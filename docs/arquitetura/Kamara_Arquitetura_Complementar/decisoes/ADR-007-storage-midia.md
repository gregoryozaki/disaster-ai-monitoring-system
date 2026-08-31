# Storage físico de mídia

**Status:** Aceito

## Contexto

O Kamara é um protótipo acadêmico com PWA, dashboard,
backend relacional e serviço de IA desacoplado.

O sistema precisa armazenar fotografias e, opcionalmente,
vídeos associados às ocorrências e aos complementos.

O domínio já mantém apenas `storageRef`, sem acoplamento
a um fornecedor específico.

## Decisão

Adotar object storage compatível com a API S3.

No ambiente local de desenvolvimento será utilizado MinIO.

O PostgreSQL armazenará apenas metadados da mídia e
`storageRef`; os bytes da mídia não serão armazenados
no banco relacional.

Na primeira versão, o upload será recebido pela API,
que validará autenticação, ownership, tipo e tamanho
antes de persistir o objeto.

A implementação deverá ficar atrás de uma abstração
em `src/integrations/storage`, permitindo substituição
futura por Amazon S3, Cloudflare R2 ou outro storage
S3-compatible.

## Consequências

- MinIO passa a compor a infraestrutura local.
- PostgreSQL não armazena arquivos binários.
- A API controla autorização do upload.
- Foto será implementada primeiro.
- Vídeo será adicionado posteriormente.
- O domínio continuará referenciando mídia por `storageRef`.
- O bucket de mídia deve permanecer privado.
- Imagens aceitas na primeira versão: JPEG, PNG e WebP.
- O limite inicial de tamanho para imagens é de 10 MB.
- A validade do formato deve ser verificada pelo conteúdo binário,
  não apenas pelo MIME declarado pelo cliente.
- Uma ocorrência pode possuir no máximo uma imagem marcada como
  principal.
- A unicidade da imagem principal é garantida por índice único
  parcial no PostgreSQL.
- Falha na persistência dos metadados após upload deve provocar
  remoção compensatória do objeto no storage.