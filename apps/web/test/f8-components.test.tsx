import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { Antispam } from '../src/components/relationship/antispam';
import { NewsletterForm } from '../src/components/relationship/newsletter-form';
import { SearchOverlay } from '../src/components/site/search-overlay';
import { relationshipApi } from '../src/lib/relationship-api';
import { Contacts } from '../src/components/admin/contacts';
import { adminApi } from '../src/lib/admin-api';
import type { AdminContact } from '@filaretti/types';
import { LinkButton } from '@filaretti/ui';

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('../src/lib/relationship-api', () => ({ relationshipApi: vi.fn() }));
vi.mock('../src/lib/admin-api', () => ({ adminApi: vi.fn() }));

test('link actions keep their destination and callback while disabled actions remain inert', () => {
  const click = vi.fn((event: MouseEvent<HTMLAnchorElement>) => event.preventDefault());
  const view = render(
    <LinkButton href="#conteudo" onClick={click}>
      Abrir conteúdo
    </LinkButton>,
  );
  const link = screen.getByRole('link', { name: 'Abrir conteúdo' });
  expect(link).toHaveAttribute('href', '#conteudo');
  fireEvent.click(link);
  expect(click).toHaveBeenCalledOnce();
  view.rerender(
    <LinkButton href="#conteudo" onClick={click} disabled>
      Abrir conteúdo
    </LinkButton>,
  );
  expect(link).not.toHaveAttribute('href');
  expect(link).toHaveAttribute('aria-disabled', 'true');
  expect(link).toHaveAttribute('tabindex', '-1');
  fireEvent.click(link);
  expect(click).toHaveBeenCalledOnce();
});

describe('antispam provider states', () => {
  test('missing configuration announces the failure and never supplies a token', async () => {
    const onToken = vi.fn();
    render(<Antispam action="contact" config={{ mock: false }} onToken={onToken} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('indisponível');
    expect(onToken).toHaveBeenCalledWith('');
    expect(onToken.mock.calls.every(([token]) => token === '')).toBe(true);
    expect(document.querySelector('script[src*="cloudflare"]')).toBeNull();
  });

  test('blocked script loads remain denied, retry attaches the document nonce and expired tokens clear', async () => {
    const meta = document.createElement('meta');
    meta.name = 'filaretti-nonce';
    meta.content = 'document-nonce-fictitious';
    document.head.append(meta);
    const onToken = vi.fn();
    const view = render(
      <Antispam
        action="newsletter"
        config={{ mock: false, siteKey: 'fictitious-site-key' }}
        onToken={onToken}
      />,
    );
    const first = await waitFor(() => {
      const script = document.querySelector<HTMLScriptElement>('script[src*="cloudflare"]');
      expect(script).not.toBeNull();
      return script!;
    });
    expect(first.nonce).toBe(meta.content);
    fireEvent.error(first);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar');
    expect(first.isConnected).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar verificação novamente' }));
    const second = await waitFor(() => {
      const script = document.querySelector<HTMLScriptElement>('script[src*="cloudflare"]');
      expect(script).not.toBeNull();
      return script!;
    });
    let callbacks:
      { callback: (token: string) => void; 'expired-callback': () => void } | undefined;
    const remove = vi.fn();
    const renderWidget = vi.fn((_element: HTMLElement, options: NonNullable<typeof callbacks>) => {
      callbacks = options;
      return 'fictitious-widget';
    });
    Object.defineProperty(window, 'turnstile', {
      configurable: true,
      value: { render: renderWidget, remove },
    });
    fireEvent.load(second);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());
    callbacks!.callback('fictitious-token');
    expect(onToken).toHaveBeenLastCalledWith('fictitious-token');
    callbacks!['expired-callback']();
    expect(onToken).toHaveBeenLastCalledWith('');
    view.unmount();
    expect(remove).toHaveBeenCalledWith('fictitious-widget');
    Reflect.deleteProperty(window, 'turnstile');
  });
});

test('newsletter failure preserves input and retry reports pending confirmation, never activation', async () => {
  const request = vi.mocked(relationshipApi);
  request.mockRejectedValueOnce(new Error('Serviço temporariamente indisponível.'));
  request.mockResolvedValueOnce({ accepted: true, message: 'Recebido.' });
  render(<NewsletterForm config={{ mock: true }} />);
  fireEvent.change(screen.getByRole('textbox', { name: /^E-mail/u }), {
    target: { value: 'ficticio@example.test' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Solicitar inscrição' })).toBeEnabled(),
  );
  fireEvent.submit(screen.getByRole('button', { name: 'Solicitar inscrição' }).closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('temporariamente indisponível');
  expect(screen.getByRole('textbox', { name: /^E-mail/u })).toHaveValue('ficticio@example.test');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Solicitar inscrição' })).toBeEnabled(),
  );
  fireEvent.submit(screen.getByRole('button', { name: 'Solicitar inscrição' }).closest('form')!);
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('instruções por e-mail para confirmar'),
  );
  expect(screen.getByRole('status')).not.toHaveTextContent('Inscrição confirmada');
  expect(request).toHaveBeenLastCalledWith(
    'newsletter/subscribe',
    expect.objectContaining({
      email: 'ficticio@example.test',
      consent: true,
      turnstileToken: 'local-development-newsletter',
    }),
  );
  expect(screen.getByRole('textbox', { name: /^E-mail/u })).toHaveValue('');
});

test('search dialog focuses its labelled field, closes on Escape and restores trigger focus', async () => {
  const close = vi.fn();
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const view = render(<SearchOverlay open onClose={close} />);
  const input = screen.getByRole('searchbox', { name: 'O que você procura?' });
  await waitFor(() => expect(input).toHaveFocus());
  expect(input).toHaveAttribute('required');
  expect(input).toHaveAttribute('minlength', '2');
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Buscar no site' }), { key: 'Escape' });
  expect(close).toHaveBeenCalledOnce();
  view.unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});

test('asynchronous contact detail restores its opener after pending disabled it and focus was lost', async () => {
  const contact: AdminContact = {
    id: 'fictitious-contact',
    name: 'Pessoa fictícia',
    email: 'ficticio@example.test',
    phone: null,
    state: null,
    subject: 'Solicitação fictícia',
    message: 'Mensagem fictícia de teste.',
    practiceAreaId: null,
    status: 'NEW',
    privacyVersion: 'development-v1',
    version: 1,
    consentedAt: '2026-10-04T12:00:00Z',
    createdAt: '2026-10-04T12:00:00Z',
    updatedAt: '2026-10-04T12:00:00Z',
    attachments: [],
  };
  let resolveDetail!: (value: AdminContact) => void;
  const detail = new Promise<AdminContact>((resolve) => {
    resolveDetail = resolve;
  });
  const request = vi.mocked(adminApi);
  request.mockResolvedValueOnce({
    data: [contact],
    meta: { page: 1, limit: 12, total: 1, pages: 1 },
  });
  request.mockReturnValueOnce(detail);
  render(<Contacts />);
  const opener = await screen.findByRole('button', { name: 'Ver solicitação' });
  opener.focus();
  fireEvent.click(opener);
  expect(opener).toBeDisabled();
  // Chromium drops focus when the active opener becomes disabled; reproduce that before resolving.
  document.body.tabIndex = -1;
  document.body.focus();
  expect(opener).not.toHaveFocus();
  await act(async () => resolveDetail(contact));
  const dialog = await screen.findByRole('dialog', { name: contact.subject });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  document.body.removeAttribute('tabindex');
  expect(opener).toBeEnabled();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(opener).toHaveFocus());
  expect(screen.queryByRole('dialog')).toBeNull();
});
