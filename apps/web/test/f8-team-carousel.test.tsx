import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { TeamCarousel } from '../src/components/institutional/team-carousel';

const members = [
  { id: 'a', name: 'Perfil A', title: 'Advogado', href: '/profissionais/perfil-a' },
  { id: 'b', name: 'Perfil B', title: 'Advogada', href: '/profissionais/perfil-b' },
];

function setMotionPreference(matches: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('rotates after five seconds and pauses when a visitor selects a profile', () => {
  vi.useFakeTimers();
  setMotionPreference(false);
  render(<TeamCarousel members={members} />);

  expect(screen.getByRole('heading')).toHaveTextContent('Perfil A');
  act(() => vi.advanceTimersByTime(4999));
  expect(screen.getByRole('heading')).toHaveTextContent('Perfil A');
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole('heading')).toHaveTextContent('Perfil B');

  fireEvent.click(screen.getByRole('button', { name: 'Ver slide de Perfil A' }));
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByRole('heading')).toHaveTextContent('Perfil A');
  expect(screen.getByRole('link', { name: 'Ver perfil' })).toHaveAttribute(
    'href',
    members[0]!.href,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Retomar rotação' }));
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByRole('heading')).toHaveTextContent('Perfil B');
});

test('offers manual selection with reduced motion', () => {
  vi.useFakeTimers();
  setMotionPreference(true);
  render(<TeamCarousel members={members} />);

  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole('heading')).toHaveTextContent('Perfil A');
  expect(screen.queryByRole('button', { name: /rotação/u })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Ver slide de Perfil B' }));
  expect(screen.getByRole('button', { name: 'Ver slide de Perfil B' })).toHaveAttribute(
    'aria-current',
    'true',
  );
});
