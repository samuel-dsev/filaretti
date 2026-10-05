import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';

import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Filaretti — site institucional',
  description:
    'Informações institucionais, áreas de atuação, profissionais e conteúdos publicados.',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="pt-BR" className={`${inter.variable} ${cormorant.variable}`}>
      <head>
        <meta name="filaretti-nonce" content={nonce} />
      </head>
      <body>
        <a className="skip-link" href="#conteudo">
          Ir para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
