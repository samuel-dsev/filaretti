# Avaliação de hospedagem — 19/11/2026

Aplicação `0.13.20`, branch `dev`, base `e174391`. Domínio informado pelo usuário: `ettorifilaretti.adv.br`, adquirido no Registro.br. Escopo atual: preservar o sistema completo e avaliar hospedagem gerenciada e a VPS existente junto ao painel, sem contratar. Não foram preparados artefatos de publicação nem realizadas alterações remotas.

## Requisitos verificados no projeto

- Node `>=24.18.0 <25`, pnpm `11.25.0` e monorepo com pacotes compartilhados.
- Next.js SSR: `apps/web/package.json` inicia `next start`; o layout institucional usa `force-dynamic`. Não existe exportação estática pronta.
- API NestJS separada, com workers de CMS/relacionamento executados no processo contínuo.
- PostgreSQL específico no Prisma/adaptador e nas consultas; MySQL não é substituição apenas de configuração.
- Web encaminha API e mídia; origem, cookies, nonce, revalidação e IP confiável exigem configuração coerente do ingress.
- Produção exige mídia aprovada em R2, integrações/antispam reais e scanner de anexos conforme os gates existentes. A avaliação de hosting não comprova esses fornecedores.

## Hostinger Premium e Business/Cloud

O conector autenticado confirmou um Premium ativo e 12 websites, nenhum correspondente à Filaretti. O Premium não oferece o runtime Node requerido. Business/Cloud suportam Next, Nest, Node 24 e pnpm/monorepo, com cada app como website separado, mas não incluem PostgreSQL e não suportam workers permanentes/endless timers. Seriam necessários banco externo e adaptação das tarefas para cron ou execução externa. Portanto, um upgrade isolado não resolve toda a aplicação atual.

Fontes primárias: [Node e planos](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/), [monorepo/pnpm](https://www.hostinger.com/support/how-to-deploy-monorepos-with-npm-yarn-or-pnpm-on-hostinger/), [limites dos workers](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/), [bancos suportados](https://www.hostinger.com/support/which-databases-and-data-tools-are-supported-at-hostinger/), [skill oficial de deploy](https://github.com/hostinger/claude-plugin/blob/main/skills/deploy-to-hosting/SKILL.md).

## VPS existente e domínio separado

API Hostinger e SSH somente leitura confirmaram uma KVM 1 ativa com 1 vCPU, 4 GB nominais de RAM e 50 GB nominais de disco, Ubuntu/Easypanel. Existem 16 contêineres ativos: WAIA produção/V2, dois n8n e infraestrutura. Traefik já publica 80/443; Easypanel usa 3000, e o painel/API WAIA têm encaminhamentos locais próprios.

| Medida                                     | Resultado observado                 |
| ------------------------------------------ | ----------------------------------- |
| Memória disponível no instante da consulta | 2120 MiB, aproximadamente 2,1 GiB   |
| Swap                                       | Ausente                             |
| Disco livre em `/`                         | 31 GiB                              |
| Load de 1 minuto                           | 0,28 em 1 vCPU                      |
| CPU Hostinger em 48 amostras de 19/11 UTC  | Média 14,48%; pico amostrado 19,54% |

É arquiteturalmente possível manter o site completo na mesma VPS, com `ettorifilaretti.adv.br` apontando apenas para a web Filaretti e HTTPS próprio. O domínio e `/admin` desse site não precisam substituir o painel WAIA. A API pode ficar privada, encaminhada pela web na mesma origem, sem exigir outro domínio público.

Uma implantação futura deve usar projeto próprio, web e API em contêineres separados, PostgreSQL 17 próprio, rede/volumes/credenciais próprios e rota do novo hostname no Traefik já existente. Não iniciar outro proxy disputando 80/443, compartilhar o banco WAIA ou modificar as allowlists administrativas existentes. Usar imagens compiladas fora dessa VPS, com versão/digest identificado, para evitar disputar memória/CPU durante builds.

A capacidade observada permite considerar um ensaio isolado de baixo tráfego; não certifica produção nem garante que todo o conjunto, incluindo scanner de anexos, caiba nessa margem. Dimensionar e impor limites de CPU/RAM, medir picos e preservar margem para WAIA/n8n antes de aceitar carga pública. Domínios e contêineres distintos continuam compartilhando hardware e indisponibilidade do host. Um upgrade de VPS somente deverá ser considerado se as medições justificarem, com aprovação específica de custo.

Não há nova mensalidade de servidor se a capacidade atual for suficiente. Continuam existindo custos/condições de mídia, e-mail, backup e demais serviços usados. Essa VPS exige manutenção do sistema e dos bancos, mesmo com Easypanel; não equivale a uma plataforma integralmente gerenciada.

Fontes: métricas autenticadas Hostinger e comandos SSH `docker ps`, `docker stats --no-stream`, `free -m`, `df -h /`, `uptime`; [domínios, imagens e recursos no Easypanel](https://easypanel.io/docs/services/app), [limites de recursos Docker](https://docs.docker.com/engine/containers/resource_constraints/). Evidências sanitizadas em `.local/hostinger-deployment/2026-11-19-assessment.json`.

## Comparação de alternativas

| Destino                                                | Compatibilidade                                                                                        | Referência de custo e condição                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| VPS existente                                          | Preserva Next/Nest/workers/PostgreSQL, com isolamento e dimensionamento                                | Sem novo servidor se couber; manutenção e disputa de recursos ficam sob nossa operação              |
| Render: dois serviços Node pagos + Postgres gerenciado | Caminho gerenciado mais direto; mantém workers dentro da API contínua                                  | Piso publicado de US$ 20/mês: 2 × US$ 7 + banco mínimo US$ 6; exemplo com banco de 1 GB: US$ 33/mês |
| Hostinger Business/Cloud + PostgreSQL externo          | Possível com adaptação dos workers, dois websites Node e banco externo                                 | Upgrade depende da cotação da conta; banco e demais serviços são adicionais                         |
| Vercel Pro web + Railway API + Postgres                | Arquitetura viável; API contínua; configurar backup/recuperação e conferir o escopo de gestão do banco | Vercel Pro US$ 20/mês + Railway por consumo; Pro Railway tem piso US$ 20, Hobby US$ 5 para ensaios  |

Valores em dólar são preços públicos consultados, sem conversão cambial, impostos, excedentes, planos de equipe, scanner, mídia ou e-mails. Pisos de memória não são dimensionamento validado para este sistema. Não houve cotação de upgrade nem compra. O conector atual não retornou uma operação de cotação de upgrade do Premium.

Render suporta [Next SSR](https://render.com/docs/deploy-nextjs-app), [Node 24](https://render.com/docs/node-version), [monorepo](https://render.com/docs/monorepo-support) e [PostgreSQL 17 gerenciado, conexão privada e recuperação](https://render.com/docs/postgresql-creating-connecting). Preços: [tabela pública](https://render.com/pricing) e [serviços pagos sempre ativos a partir de US$ 7](https://render.com/hosting/docker). Serviços gratuitos suspendem por inatividade e o banco gratuito expira; não são a configuração de produção proposta.

Vercel: [Pro e restrição de uso comercial do Hobby](https://vercel.com/pricing). Railway: [planos por consumo](https://railway.com/pricing) e [PostgreSQL/operacionalização](https://docs.railway.com/databases/postgresql). A documentação atual informa que o template padrão é mantido pela Railway e orienta habilitar backups/PITR e configurar alta disponibilidade quando necessária; conferir as responsabilidades exatas do serviço escolhido, sem tratar qualquer contêiner PostgreSQL como equivalente a esse serviço. Outra opção de banco externo é o [Neon Launch](https://neon.com/pricing), que cobra por consumo e não tem custo mensal fixo garantido. Os timers da API podem manter o banco ativo e reduzir a economia de suspensão.

## Preparação necessária após escolha e autorização

1. Gerar imagens/configuração revisáveis para o destino escolhido, sem alterar o servidor nesta avaliação. Manter a raiz do monorepo no build e fixar Node/pnpm.
2. Ajustar bind/portas: a web atual fixa `127.0.0.1:3000`, e a API usa `API_HOST`/`API_PORT`. Em contêineres, escutar em `0.0.0.0` internamente, sem expor banco/API diretamente na Internet.
3. Validar IP de cliente/ingress. O código atual aceita `x-real-ip` ou `cf-connecting-ip`; não basta marcar o proxy como confiável. O filtro de ambiente do Turbo também precisa ser conferido para build de produção.
4. Provisionar ambiente e banco isolados, migrations compatíveis, conteúdo/mídia aprovados e ADMIN próprio; não copiar usuários, contatos ou o banco de desenvolvimento integralmente.
5. Comprovar R2, Resend, Turnstile, scanner, backup/restore, publicação e autenticação. Medir consumo/carga, reinício dos workers e convivência com o painel.
6. Preparar registros DNS específicos de `ettorifilaretti.adv.br` no provedor DNS autoritativo existente, sem transferir obrigatoriamente o registro. Nesta consulta, o resolver local expirou; nameservers e registros atuais permanecem não verificados. Preservar eventuais registros de e-mail e só executar o corte quando autorizado.

Conclusão: a VPS existente é a opção de menor custo imediato para um ensaio de coexistência; Render é a alternativa gerenciada mais direta para separar a infraestrutura do painel. Nenhum destino foi contratado, provisionado ou publicado. F8/F9/F10 continuam parciais, e a versão permanece `0.13.20`.
