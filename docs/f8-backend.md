# F8 — Hardening e operação local da API

Referência: `0.8.0`, 04/10/2026. Esta entrega prepara e verifica controles locais. Não representa homologação externa nem autorização de publicação.

## Saúde, métricas e sinal de alerta

- `GET /health/live`: processo HTTP ativo, `200 { status: "ok" }`, sem dependência de banco.
- `GET /health/ready`: consulta PostgreSQL real com os timeouts de conexão/consulta existentes; `200` com banco disponível e `503` com banco indisponível. `/health` preserva o contrato anterior de readiness.
- `GET /api/v1/admin/operations`: exige sessão ADMIN. EDITOR recebe 403 e visitante 401; resposta `private, no-store` e `noindex`. Projeta somente contagens das quatro filas conhecidas, sem payloads, IDs, destinatários, chaves de storage ou erros de fornecedor.
- `alerts.exhaustedTasks` conta tarefas FAILED; `quarantinedAttachments` conta anexos em quarentena; `overdueTasks` indica PENDING cuja disponibilidade venceu há 15 minutos; `expiredLeases` indica PROCESSING sem lease ou com lease vencido há 5 minutos. Qualquer contador positivo produz `status: "attention"`.

O sinal persiste no PostgreSQL e continua observável após reinício, incluindo falhas de recuperação de lease. Logs dos workers preservam eventos genéricos de exaustão, sem conteúdo das tarefas. E-mails finais expiram após sete dias conforme a retenção existente. O responsável operacional precisa configurar a coleta privada e o destino do alerta antes da homologação; nenhum pager, Sentry remoto ou envio real de alerta foi ativado nesta fase local. Readiness do banco não atesta que fornecedores ou um worker externo estejam disponíveis.

## Origem e identidade do visitante

CORS permanece fechado: navegador usa o BFF na mesma origem e a API não emite `Access-Control-Allow-Origin`. Express mantém `trust proxy=false` e ignora `X-Forwarded-For`, `X-Real-IP` e protocolo encaminhado arbitrários. A validação de Origin/CSRF e os limites PostgreSQL existentes continuam independentes.

O BFF assina uma identidade obtida do edge confiável com `BFF_CLIENT_IP_SECRET`, compartilhado apenas entre processos web/API. A API consome os headers `x-filaretti-client-ip`, `x-filaretti-client-timestamp` e `x-filaretti-client-signature` em contato, newsletter, login e recuperação/reset de senha. A assinatura é HMAC-SHA256 sobre:

```text
timestamp_em_milissegundos\nMETHOD\npathname_da_API\nIP
```

A chave é decodificada de 64 caracteres hexadecimais; método é maiúsculo; pathname inclui `/api/v1` e exclui query. O timestamp tem 13 dígitos e tolerância de 60 segundos. A API valida IP único IPv4/IPv6, formato da assinatura e comparação constante. Cabeçalhos parciais, adulterados, expirados ou pertencentes a outra rota/método recebem 403. Fora de development, ausência da assertion recebe 503 em fluxos que precisam de identidade; em development sem assertion, usa o endereço do socket.

A assinatura autentica o BFF, não torna confiável a origem do header recebido pelo próprio BFF. O deploy deve comprovar que o edge sobrescreve o header configurado e impede acesso direto ao origin. `WEB_CLIENT_IP_HEADER` e `WEB_TRUSTED_PROXY_CONFIRMED` constituem esse gate; uma flag sozinha não comprova a topologia. Não confiar em uma lista de IPs fornecida pelo visitante. Leituras públicas e health não exigem a assertion.

Respostas têm `nosniff`, `no-referrer`, `X-Frame-Options: DENY`, Permissions Policy restrita e `Cross-Origin-Resource-Policy: same-origin`; `X-Powered-By` foi removido. Fora de development, CSP de respostas API bloqueia fontes, embedding, base e formulários. HSTS só é emitido quando a URL pública configurada da API usa HTTPS, sem `includeSubDomains`; não depende de `X-Forwarded-Proto`.

## Scanner de anexos privados

`CONTACT_SCANNER_DRIVER=clamav` usa ClamD INSTREAM, com tamanho máximo de 10 MiB por scan, timeout absoluto e resposta limitada a 4 KiB. Transmite bytes, não caminhos locais. Analisa o original e a versão validada/normalizada, com prazo total de 15 segundos para os scans de uma solicitação. Somente duas respostas completas `stream: OK` permitem gravar `VERIFIED`.

Detecção `FOUND` rejeita o envio com 400 `ATTACHMENT_REJECTED`; o conteúdo infectado não entra no storage. Resposta inválida, truncada, excessiva, erro ou timeout conserva `QUARANTINED`, mantendo o aceite do contato e bloqueando a emissão/consumo de tickets. Não existe liberação manual ou automática posterior nesta entrega: anexos em quarentena continuam inacessíveis até o descarte pela retenção. A recuperação de anexos já em quarentena deve ser definida antes de receber dados reais; não promover metadata a VERIFIED sem comprovar os bytes examinados.

Driver `disabled` somente permite `LOCAL_VERIFIED` em mocks locais de development. Fora desses mocks, conserva quarentena. Configuração ClamD exige host/porta/timeout e confirmação de rede privada fora de development. ClamD TCP não autentica nem cifra suas conexões; limitar acesso ao processo da API, sem exposição pública. Atualização das definições, supervisão do daemon, limites internos de scan e monitoramento da idade das assinaturas são gates operacionais. [Protocolo ClamD](https://docs.clamav.net/manual/Usage/ClamdProtocol.html), [recomendações de rede](https://docs.clamav.net/manual/Usage/Scanning.html).

## Evidências executadas e reprodução

- `pnpm --filter @filaretti/api lint`: aprovado.
- `pnpm test:integration`: 72 testes, zero falhas/skips, PostgreSQL real, quatro migrations, seeds/provisionamento e bancos temporários próprios. Inclui cinco cenários F8 de autorização, contagens sanitizadas, limites por visitante assinado, indisponibilidade do scanner/quarentena e exaustão do worker.
- Fundação HTTP nativa e Jest protegem saúde, headers, proteção de assinatura e protocolo ClamD simulado. O total final integrado e checks globais ficam no relatório da fase. Jest exige `--experimental-vm-modules` para carregar as dependências ESM do NestJS na versão atual.
- ClamAV real `1.5.4`, imagem oficial fixada em `clamav/clamav@sha256:ebec5bc138401b36ae987caa1a3fa3c3b2a21ed3d51f0bfa5852825e663e67b0`; definições `28136`, datadas de 27/09/2026, pré-carregadas. FreshClam foi desativado exclusivamente para a fixture local; atualização online não foi validada.
- Teste explícito `apps/api/test/clamav.system.test.ts`: daemon real detectou EICAR padrão isolado; PNG benigno gerou VERIFIED; marcador fictício em PNG válido, reconhecido por assinatura real de teste adicional, foi recusado antes da persistência; ADMIN baixou o arquivo limpo uma única vez; acesso público permaneceu 404. Banco/storage temporários próprios e container foram removidos ao término.

Para repetir o teste real, iniciar um container privado próprio, com o digest acima e porta loopback livre. Carregar **somente nesse container descartável** a assinatura `filaretti-f8-test.ndb` abaixo em `/var/lib/clamav`, executar `clamdscan --reload` e aguardar reload:

```text
Filaretti.Test.F8:0:*:46382d414e544956495255532d46495854555245
```

Ela identifica o marcador `F8-ANTIVIRUS-FIXTURE` usando o formato oficial [.ndb](https://docs.clamav.net/manual/Signatures/BodySignatureFormat.html); não deve entrar no banco de definições operacional. Compilar os testes com `pnpm --filter @filaretti/api exec tsc -p tsconfig.test.json`, configurar `F8_CLAMAV_PORT` no processo e executar, pelo workspace da API, `node --test dist-test/test/clamav.system.test.js`. O teste exige APP_ENV development, PostgreSQL local com permissão para criar banco e um daemon real; não faz parte da suíte automática padrão e não utiliza banco/volume de desenvolvimento para seus dados.

O primeiro experimento com EICAR simplesmente anexado ao final de PNG não foi detectado pelo daemon: essa fixture não comprova uma detecção em container arbitrário. Foi substituído pelo teste explícito de assinatura fictícia, mantendo o EICAR isolado como teste padrão. Essas evidências comprovam a integração/proteção das respostas, não uma cobertura universal de malware. Upload continua validando MIME/estrutura, reencodificando imagens e rejeitando conteúdo PDF ativo independentemente do scanner.
