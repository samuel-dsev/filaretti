import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// jsdom does not implement the browser's dialog top layer or rendered rectangles.
// Browser QA separately verifies the native modal, focus trap and keyboard behavior.
Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
  configurable: true,
  value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  },
});
Object.defineProperty(HTMLDialogElement.prototype, 'close', {
  configurable: true,
  value: function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  },
});
Object.defineProperty(HTMLElement.prototype, 'getClientRects', {
  configurable: true,
  value: () => [new DOMRect(0, 0, 100, 40)],
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.head
    .querySelectorAll('script,meta[name="filaretti-nonce"]')
    .forEach((node) => node.remove());
});
