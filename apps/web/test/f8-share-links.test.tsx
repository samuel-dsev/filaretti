import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ShareLinks } from '../src/components/editorial/share-links';
import { trackAnalytics } from '../src/components/privacy/consent-provider';

vi.mock('../src/components/privacy/consent-provider', () => ({ trackAnalytics: vi.fn() }));

test('successful clipboard sharing records only the allowed event name without publication data', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const url = 'https://example.test/conteudos/publicacao-ficticia';
  render(<ShareLinks title="Publicação fictícia" url={url} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Link copiado.'));
  expect(writeText).toHaveBeenCalledWith(url);
  expect(trackAnalytics).toHaveBeenCalledExactlyOnceWith('article_share');
});

test('failed clipboard copying keeps the manual fallback and does not record a completed share', async () => {
  const writeText = vi.fn().mockRejectedValue(new Error('Clipboard unavailable'));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const url = 'https://example.test/conteudos/publicacao-ficticia';
  render(<ShareLinks title="Publicação fictícia" url={url} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }));
  const field = await screen.findByRole('textbox', { name: 'Endereço desta publicação' });
  expect(field).toHaveValue(url);
  await waitFor(() => expect(field).toHaveFocus());
  expect(trackAnalytics).not.toHaveBeenCalled();
});
