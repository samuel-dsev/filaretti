import 'dotenv/config';
import 'reflect-metadata';
import { isDeepStrictEqual } from 'node:util';
import { validateApiEnvironment } from '@filaretti/config';
import type { PageSection, TipTapNode } from '@filaretti/types';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../src/database/prisma.service';
import { PageDto } from '../src/domain/dto';
import { InstitutionService } from '../src/domain/institution.service';

const slug = 'sobre-nos';
const title = 'Sobre nós';
const seoTitle = 'Sobre nós | Éttori & Filaretti Advogados';
const seoDescription =
  'Conheça a Éttori & Filaretti Advogados, escritório de Taubaté (SP) com atuação em Direito Imobiliário, Condominial e Resolução Contratual.';

function paragraph(text: string, href?: string): TipTapNode {
  return {
    type: 'paragraph',
    content: [
      { type: 'text', text, ...(href ? { marks: [{ type: 'link', attrs: { href } }] } : {}) },
    ],
  };
}

function practice(name: string, text: string): TipTapNode {
  return {
    type: 'paragraph',
    content: [
      { type: 'text', text: name, marks: [{ type: 'bold' }] },
      { type: 'hardBreak' },
      { type: 'text', text },
    ],
  };
}

const sections: PageSection[] = [
  {
    key: 'intro',
    body: {
      type: 'doc',
      content: [
        paragraph(
          'Somos a Éttori & Filaretti Advogados, escritório de Taubaté (SP) com atuação em Direito Imobiliário e Condominial.',
        ),
        paragraph(
          'Orientamos pessoas, condomínios e empresas em decisões sobre imóveis e contratos. Em cada caso, explicamos os riscos, as opções e o que cada caminho pode exigir.',
        ),
      ],
    },
  },
  {
    key: 'como-trabalhamos',
    heading: 'Como trabalhamos',
    body: {
      type: 'doc',
      content: [
        paragraph(
          'Começamos por entender o que está em jogo e examinar os documentos relevantes. A partir daí, avaliamos as alternativas com o cliente. Conforme o caso, o trabalho pode envolver a revisão de um contrato, a negociação de um acordo ou a atuação judicial.',
        ),
      ],
    },
  },
  {
    key: 'areas-de-atuacao',
    heading: 'Áreas de atuação',
    body: {
      type: 'doc',
      content: [
        practice(
          'Direito Imobiliário',
          'Assessoria na compra, venda, locação e regularização de imóveis, com análise de documentos e revisão de contratos.',
        ),
        practice(
          'Direito Condominial',
          'Orientação sobre convenções, assembleias, cobranças e conflitos relacionados à administração e à convivência em condomínio.',
        ),
        practice(
          'Resolução Contratual',
          'Análise de cláusulas e orientação em situações de descumprimento, encerramento ou renegociação de contratos.',
        ),
        paragraph('Ver áreas de atuação', '/areas-de-atuacao'),
      ],
    },
  },
  {
    key: 'onde-estamos',
    heading: 'Onde estamos',
    body: {
      type: 'doc',
      content: [
        paragraph(
          'O escritório fica em Taubaté, no interior de São Paulo. O atendimento pode ser presencial ou online.',
        ),
        paragraph('Conheça o escritório e veja a localização', '/o-escritorio'),
      ],
    },
  },
];

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.env.APP_ENV !== 'development' ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '5434' ||
    url.pathname !== '/filaretti_dev'
  )
    throw new Error('LOCAL_ABOUT_UPDATE_FORBIDDEN');

  const environment = { ...validateApiEnvironment(process.env), MOCK_CONTENT: true };
  const db = new PrismaService(environment);
  const cms = new InstitutionService(db, environment);
  const content = { title, seoTitle, seoDescription, sections };

  try {
    const [admin] = await db.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      orderBy: { id: 'asc' },
      take: 1,
      select: { id: true, email: true, name: true, role: true },
    });
    if (!admin) throw new Error('LOCAL_ABOUT_ADMIN_REQUIRED');
    const actor = { ...admin, sessionId: '' };
    const current = await db.page.findUnique({ where: { slug } });
    if (
      current?.title === title &&
      current.seoTitle === seoTitle &&
      current.seoDescription === seoDescription &&
      isDeepStrictEqual(current.sections, sections) &&
      current.status === 'PUBLISHED'
    ) {
      console.log('Sobre nós já está atualizada no CMS local.');
      return;
    }

    const dto = plainToInstance(PageDto, { ...content, slug });
    if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length)
      throw new Error('LOCAL_ABOUT_INVALID_CONTENT');

    const updated = current
      ? await cms.updatePage(current.id, { ...content, version: current.version }, actor)
      : await cms.createPage(dto, actor);
    if (updated.status !== 'PUBLISHED')
      await cms.publishPage(updated.id, { version: updated.version, status: 'PUBLISHED' }, actor);
    console.log('Sobre nós atualizada no CMS local.');
  } finally {
    await db.$disconnect();
  }
}

void main().catch(() => {
  console.error('Não foi possível atualizar Sobre nós no CMS local.');
  process.exitCode = 1;
});
