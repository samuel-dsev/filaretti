# Manual de uso e manutenção do CMS

Manual de entrega preparado na F10 local (`0.10.0`). O endereço operacional, responsáveis e treinamento serão registrados após definição/aprovação do ambiente. Não usar contas ou conteúdos de demonstração em produção.

## Acesso e permissões

Abrir `/admin/login` na origem aprovada e usar a conta individual provisionada. ADMIN mantém usuários, configurações, redirects, contatos e assinantes; EDITOR mantém e publica conteúdos; AUTHOR cria/edita seus próprios rascunhos e sua mídia. Recuperação está em `/admin/recuperar-senha`; depende de entrega de e-mail configurada. Desativar usuário revoga seu acesso. Nunca compartilhar senhas ou links de recuperação.

## Conteúdo e publicação

Manter primeiro áreas, profissionais, categorias e tags; depois relacionar o artigo ao profissional e às áreas apropriados. Informar tipo, título, slug, resumo, corpo, relacionamentos e campos SEO. Conferir headings, links, texto alternativo e origem/licença das mídias antes da publicação.

Salvar conserva o rascunho. Preview permite revisão por link com expiração e revogação; compartilhar apenas com revisores autorizados. Publicar, agendar, retirar e arquivar são ações distintas. Datas de agendamento aparecem em America/Sao_Paulo; o serviço grava UTC. Pelo menos uma instância API/worker precisa permanecer ativa. A publicação vencida é retomada depois de reinício.

Quando houver conflito de edição, conservar suas alterações, recarregar a versão atual e reaplicar somente o que ainda cabe. Não contornar o aviso para sobrescrever outra pessoa. Retirar publicação deve interromper imediatamente novas consultas públicas, busca e sitemap; validar essas superfícies ao corrigir material já publicado.

## Institucional e mídia

Páginas, FAQ, áreas, profissionais e configurações usam as respectivas telas. Publicar políticas aprovadas antes de receber dados reais. Home/escritório ainda dependem de substituição das ilustrações demonstrativas antes da release oficial; uma alteração de texto no CMS não substitui esses ativos de apresentação.

Imagens JPG/PNG/WebP/AVIF aceitam até 5 MiB; PDF, até 10 MiB. Arquivos ativos/inválidos são recusados. Mídia em uso não pode ser removida. Anexos de contato são privados e têm regras diferentes de PDFs editoriais. Não publicar anexo recebido como mídia sem processo próprio de aprovação.

## Contatos e assinantes

ADMIN consulta contatos, atualiza status e baixa anexos autorizados por acesso temporário vinculado à sessão. Anexo em quarentena não possui liberação posterior automática: corrigir o scanner e seguir o procedimento de reenvio/revisão aprovado. Contato persistido não deve ser reenviado porque uma notificação atrasou; verificar fila operacional.

Newsletter só ativa após confirmação; descadastro interrompe mensagens pendentes relevantes. Exportação CSV é restrita a ADMIN; guardar o arquivo em local aprovado e aplicar a política de retenção. Campanhas de marketing não fazem parte desta V1.

## Manutenção e incidentes

O responsável operacional acompanha `/health/ready` e os sinais privados de `/api/v1/admin/operations` (filas, exaustão, leases e quarentena). A rota exige sessão ADMIN e não deve virar métrica pública. Definir destinatário, prazo de resposta e janela de acompanhamento no plano operacional.

Antes de mudanças, identificar commit/versão, revisar migrations e ter backup/restauração/rollback verificados. Pausar mutações e aguardar workers antes do snapshot que precisa coordenar banco e arquivos. Backups locais são descritos em [operations.md](operations.md); sua existência não comprova cópia externa nem restore R2.

Em erro impeditivo, manter evidências sanitizadas, registrar horário/versão/fluxo e acionar o responsável. Não colar tokens, dados pessoais, conexões ou corpos de mensagem no chamado. Aplicar o rollback aprovado conforme [go-live.md](go-live.md); não executar reset de banco como resposta automática.
