# Imagens da Filaretti para a VPS

Contexto de build: raiz deste monorepo. Compilar em Linux/amd64 fora da VPS compartilhada, com Docker BuildKit. Os Dockerfiles usam Node `24.18.0` em Debian Bookworm e pnpm `11.25.0`, instalação pelo lockfile e targets de runtime sem root. A referência da imagem base pode ser fixada por digest com `NODE_IMAGE`, mantendo uma versão compatível com o manifesto.

Os arquivos `Dockerfile.api.dockerignore` e `Dockerfile.web.dockerignore` são allowlists específicas dos respectivos Dockerfiles. Eles excluem ambientes, segredos, arquivos locais, Git, dependências do Windows e builds anteriores. Não adicionar esses itens a um contexto de build alternativo. O arquivo `tsconfig.json` local da web não deve ser alterado por este empacotamento.

## API e operações de banco

O target `runtime` contém API compilada, dependências de produção, pacotes compartilhados compilados e cliente Prisma gerado para Linux. A geração do cliente usa uma URL sintética e não acessa banco. O target compacto `operations` reutiliza essas dependências, inclui Prisma CLI/schema/migrations e o importador de homologação. Aceita apenas `migrate` e `import-staging`, com banco privado e ambiente staging verificados. É uma tarefa única, não um serviço público.

```sh
docker build --platform linux/amd64 -f infra/vps/Dockerfile.api --target runtime --build-arg SOURCE_COMMIT=COMMIT -t filaretti-api:VERSION .
docker build --platform linux/amd64 -f infra/vps/Dockerfile.api --target operations -t filaretti-operations:VERSION .
```

Com rede privada e ambiente do destino configurados pelo operador:

```sh
docker run --rm --network FILARETTI_NETWORK --env-file PRIVATE_API_ENV filaretti-operations:VERSION migrate
```

O target opcional `operations-full` mantém os scripts existentes `seed-production` e `provision-admin` para um futuro ambiente de produção autorizado. Esse provisionador exige senha por stdin e identidade nas variáveis já validadas; não o executar para criar a conta de staging. Não há seed de desenvolvimento nos entrypoints. A imagem de runtime recebe `APP_ENV`, banco, origem HTTPS e segredos somente ao iniciar. Ela escuta em `0.0.0.0:3001` internamente; não publicar essa porta na Internet.

## Web SSR

O build gera `output: 'standalone'` dentro do estágio descartável de Docker, sem modificar o Next config versionado. O trace inclui a raiz do monorepo. A imagem final contém o servidor Next, ativos estáticos e `public`; não depende de TypeScript ou pnpm no runtime. A execução usa `node apps/web/server.js`, `HOSTNAME=0.0.0.0` e `PORT=3000`.

```sh
docker build --platform linux/amd64 -f infra/vps/Dockerfile.web --secret id=web_build_env,src=PRIVATE_WEB_BUILD_ENV --build-arg SOURCE_COMMIT=COMMIT -t filaretti-web:VERSION .
```

`PRIVATE_WEB_BUILD_ENV` é um arquivo ignorado fora do contexto. Node carrega o mount pelo parser nativo de `.env`, sem avaliação shell. Não usar `ARG`/`ENV` de Docker para segredos. O build usa Webpack, conforme a compilação local verificada anteriormente. `next/font/google` ainda exige acesso às fontes durante o build.

O ambiente do build precisa conter a origem HTTPS final e `API_INTERNAL_URL` que resolva na rede de runtime (por exemplo `http://api:3001`), porque os rewrites ficam gravados no build. Configurar as mesmas flags públicas no build e no runtime. Para staging, o validador também exige BFF secret válido, header de IP suportado e confirmação de ingress; essa confirmação só deve representar uma política de proxy efetivamente configurada e verificada. Segredos de runtime continuam sendo fornecidos ao iniciar o serviço e não podem ser substituídos pelos valores de build.

## Verificação e limites

Antes do upload, executar build dos três targets, smoke de API/web com ambiente privado, conferir cliente Prisma/native addons no Linux, usuário não root, imagens/rotas e ausência de `.env`/segredos nas imagens e arquivos de exportação. Tag não substitui identificação por image ID/digest e checksum do arquivo transferido. O agente principal registra os resultados reais; estes arquivos sozinhos não comprovam um deploy.

Não iniciar proxy adicional nas portas 80/443. `compose.yaml` define web, API, PostgreSQL, ingresso e tarefa de operações com limites explícitos; somente o ingresso entra na rede externa `easypanel`. Nenhuma porta host nova é publicada. Os segredos reais ficam em `private/*.env`, fora do Git e do contexto de build. Integrações reais, conteúdo aprovado e os gates de produção do projeto permanecem aplicáveis.

## Homologação protegida na VPS

O primeiro destino é `/opt/filaretti/staging`, projeto `filaretti-stage`, origem `https://ettorifilaretti.adv.br`. Manter `APP_ENV=staging`, formulários/integrações/workers desligados e indexação negada até seus aceites próprios. O PostgreSQL usa volume próprio. Pré-criar o volume exclusivo `filaretti-stage_storage`, conferir/copiar suas mídias e ajustar UID/permissões antes de iniciar a API; o Compose o referencia como externo ao seu ciclo de criação. Não reutilizar banco ou volumes do WAIA.

`scripts/vps-export-public.mjs` lê exclusivamente o CMS local de desenvolvimento, remapeia referências de operadores e exporta apenas conteúdo público em diretório novo ignorado. `scripts/vps-import-staging.mjs` valida hash/envelope/mídias e só grava no banco privado `filaretti_stage`, completamente vazio, com confirmação explícita e senha de um operador novo por stdin. O comando `import-staging` do target de operações executa esse importador. Não alterar `is_mock` para promover esse snapshot a produção.

`traefik.yaml.template` deve receber somente o CIDR autorizado e ser instalado como arquivo exclusivo de rota. `ingress.conf.template` recebe o IP inspecionado do proxy; confia apenas nesse endereço, extrai o par à direita de XFF e sobrescreve o header que a web usa. A configuração compartilhada do proxy não deve ser alterada para acomodar este projeto. Confirmar a política real e testar spoof de headers, acesso direto e origem não autorizada. Se o IP do proxy mudar, o ingresso falha fechado até atualização revisada.

Ordem de operação: validar Compose sem imprimir valores → carregar imagens verificadas → iniciar PostgreSQL → migrations → importar snapshot público e mídias → API → web → ingresso → verificar HTTPS, conteúdo, sessão, isolamento e recursos. Cada passo usa somente o projeto Filaretti. Para interromper a homologação, parar seus serviços com o mesmo projeto/arquivo; nunca usar `down -v`, reset de banco, prune global ou reiniciar projetos alheios. Backup/restore e promoção pública dependem dos gates operacionais documentados.
