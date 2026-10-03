import base from '@filaretti/eslint-config/base.js';
import next from 'eslint-config-next/core-web-vitals';

const config = [
  ...base,
  ...next,
  {
    ignores: ['.next/**', 'out/**', 'next-env.d.ts'],
  },
];

export default config;
