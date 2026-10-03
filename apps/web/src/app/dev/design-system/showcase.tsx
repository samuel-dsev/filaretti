'use client';

import {
  Accordion,
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  Drawer,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LinkButton,
  Pagination,
  Select,
  Skeleton,
  Textarea,
  Toast,
} from '@filaretti/ui';
import { useState, type FormEvent } from 'react';

type DemoErrors = Partial<Record<'name' | 'email' | 'message', string>>;

export function DemoComponents({ currentPage }: { currentPage: number }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<'notice' | 'form' | null>(null);
  const [errors, setErrors] = useState<DemoErrors>({});

  function validateExample(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const nextErrors: DemoErrors = {};
    if (!String(data.get('name') ?? '').trim()) nextErrors.name = 'Informe um nome fictício.';
    const email = form.elements.namedItem('email');
    if (!(email instanceof HTMLInputElement) || !email.value.trim() || !email.validity.valid) {
      nextErrors.email = 'Informe um e-mail válido de exemplo.';
    }
    if (!String(data.get('message') ?? '').trim())
      nextErrors.message = 'Escreva uma mensagem de exemplo.';
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      requestAnimationFrame(() => document.getElementById(`demo-${firstError}`)?.focus());
      setToast(null);
    } else {
      setToast('form');
    }
  }

  return (
    <section id="componentes" className="demo-components" aria-labelledby="components-title">
      <div className="f-container">
        <div className="demo-section-heading">
          <div>
            <p className="demo-eyebrow">Biblioteca visual · F3</p>
            <h2 id="components-title">
              Elementos que dão
              <br />
              forma à experiência.
            </h2>
          </div>
          <LinkButton href="/dev/design-system/admin" variant="secondary">
            Ver layout administrativo
          </LinkButton>
        </div>
        <div className="demo-grid demo-grid--two">
          <Card>
            <h3 className="demo-card-title">Ações e identificação</h3>
            <div className="demo-row">
              <Button onClick={() => setModalOpen(true)}>Abrir modal</Button>
              <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                Abrir drawer
              </Button>
              <Button variant="ghost" onClick={() => setToast('notice')}>
                Mostrar aviso
              </Button>
              <Button disabled>Ação indisponível</Button>
              <Button loading>Carregando</Button>
            </div>
            <div className="demo-row demo-row--spaced">
              <Badge>Rascunho</Badge>
              <Badge variant="brand">Em destaque</Badge>
              <Badge variant="success">Publicado</Badge>
              <Badge variant="warning">Agendado</Badge>
              <Badge variant="danger">Requer atenção</Badge>
              <Avatar name="Pessoa fictícia" />
            </div>
            <h3 className="demo-card-title">Perguntas e respostas</h3>
            <Accordion
              items={[
                {
                  id: 'demo-faq-one',
                  title: 'Como este exemplo funciona?',
                  content:
                    'Os componentes podem ser reutilizados nas páginas do portal e do painel. Esta demonstração apresenta os seus estados e interações.',
                },
                {
                  id: 'demo-faq-two',
                  title: 'Os dados serão enviados?',
                  content:
                    'Não. O formulário valida os campos somente nesta tela. Nenhum dado é enviado ou armazenado.',
                },
              ]}
            />
          </Card>
          <Card>
            <h3 className="demo-card-title">Formulário de exemplo</h3>
            <p className="demo-small">
              Use somente dados fictícios. Este exemplo não envia nem salva informações.
            </p>
            <form noValidate onSubmit={validateExample} className="demo-form">
              <FormField id="demo-name" label="Nome fictício" required error={errors.name}>
                {(props) => (
                  <Input
                    {...props}
                    name="name"
                    autoComplete="off"
                    placeholder="Pessoa de exemplo"
                    invalid={Boolean(errors.name)}
                  />
                )}
              </FormField>
              <FormField
                id="demo-email"
                label="E-mail fictício"
                required
                help="Exemplo: pessoa@example.test"
                error={errors.email}
              >
                {(props) => (
                  <Input
                    {...props}
                    name="email"
                    type="email"
                    autoComplete="off"
                    placeholder="pessoa@example.test"
                    invalid={Boolean(errors.email)}
                  />
                )}
              </FormField>
              <FormField id="demo-area" label="Área de interesse">
                {(props) => (
                  <Select {...props} name="area" defaultValue="">
                    <option value="">Selecione uma opção</option>
                    <option value="demo">Área demonstrativa 01</option>
                  </Select>
                )}
              </FormField>
              <FormField
                id="demo-message"
                label="Mensagem de exemplo"
                required
                error={errors.message}
              >
                {(props) => (
                  <Textarea {...props} name="message" rows={3} invalid={Boolean(errors.message)} />
                )}
              </FormField>
              <Button type="submit">Validar exemplo</Button>
            </form>
          </Card>
          <Card>
            <h3 className="demo-card-title">Vazio e erro</h3>
            <EmptyState
              title="Nenhum conteúdo por aqui"
              description="Os conteúdos aparecerão quando estiverem disponíveis."
            />
            <ErrorState
              title="Não foi possível carregar"
              description="Exemplo de uma mensagem de erro. Tente novamente em alguns instantes."
            />
          </Card>
          <Card>
            <h3 className="demo-card-title">Carregamento e navegação</h3>
            <div
              className="demo-skeleton"
              role="status"
              aria-label="Exemplo de carregamento de conteúdo"
            >
              <Skeleton height="8rem" />
              <Skeleton width="80%" />
              <Skeleton width="55%" />
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={5}
              getHref={(page) => `/dev/design-system?pagina=${page}#componentes`}
            />
          </Card>
        </div>
      </div>
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Uma conversa com clareza"
        description="Exemplo de janela modal acessível."
        footer={<Button onClick={() => setModalOpen(false)}>Entendi</Button>}
      >
        <p>
          O foco permanece nesta janela enquanto ela estiver aberta. Use Escape ou o botão de
          fechamento para voltar à página.
        </p>
      </Dialog>
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Detalhes da demonstração"
        description="Um painel lateral para informações complementares."
      >
        <p>
          Uma estrutura reutilizável para navegação e detalhes. Os dados desta tela são fictícios.
        </p>
        <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
          Voltar à página
        </Button>
      </Drawer>
      {toast && (
        <Toast
          title={toast === 'form' ? 'Exemplo validado' : 'Aviso de demonstração'}
          description={
            toast === 'form'
              ? 'Nenhum dado foi enviado ou armazenado.'
              : 'Uma mensagem breve, com fechamento por botão.'
          }
          variant={toast === 'form' ? 'success' : 'info'}
          onDismiss={() => setToast(null)}
        />
      )}
    </section>
  );
}
