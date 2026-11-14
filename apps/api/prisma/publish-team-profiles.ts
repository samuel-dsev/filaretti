import 'dotenv/config';
import 'reflect-metadata';
import { validateApiEnvironment } from '@filaretti/config';
import type { TipTapDocument } from '@filaretti/types';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../src/database/prisma.service';
import { ProfessionalDto, ProfessionalPatchDto } from '../src/domain/dto';
import { InstitutionService } from '../src/domain/institution.service';

const biography: TipTapDocument = {
  type: 'doc',
  content: [
    'Entendo a advocacia como um trabalho de escuta e orientação. Procuro compreender o que levou a pessoa a buscar ajuda e o que precisa ser resolvido antes de discutir as alternativas.',
    'Começo pela leitura dos documentos e pela organização dos fatos. Gosto de explicar o que cada decisão pode exigir, quais pontos precisam de atenção e o que pode ser encaminhado por meio do diálogo.',
    'Ao longo do atendimento, mantenho uma comunicação direta e abro espaço para dúvidas. Meu objetivo é que cada pessoa consiga decidir com clareza e saiba o que esperar dos próximos passos.',
  ].map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
};

function validate<T extends object>(dto: T): T {
  if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length)
    throw new Error('INVALID_LOCAL_TEAM_CONTENT');
  return dto;
}

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.env.APP_ENV !== 'development' ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '5434' ||
    url.pathname !== '/filaretti_dev'
  )
    throw new Error('LOCAL_TEAM_UPDATE_FORBIDDEN');

  const environment = { ...validateApiEnvironment(process.env), MOCK_CONTENT: true };
  const db = new PrismaService(environment);
  const cms = new InstitutionService(db, environment);
  try {
    const admin = await db.user.findFirstOrThrow({
      where: { role: 'ADMIN', isActive: true },
      orderBy: { id: 'asc' },
      select: { id: true, email: true, name: true, role: true },
    });
    const actor = { ...admin, sessionId: '' };
    const mario = await db.professional.findUniqueOrThrow({ where: { slug: 'mario-filaretti' } });
    const marioName = 'Dr. Mario Filaretti';
    if (mario.name !== marioName) {
      if (mario.name !== 'Mario Filaretti') throw new Error('LOCAL_MARIO_NAME_CHANGED');
      const patch = validate(
        plainToInstance(ProfessionalPatchDto, { name: marioName, version: mario.version }),
      );
      await cms.updateProfessional(mario.id, patch, actor);
    }

    const erikaSlug = 'erika-ettori';
    const erika = await db.professional.findUnique({ where: { slug: erikaSlug } });
    if (!erika) {
      const profile = validate(
        plainToInstance(ProfessionalDto, {
          slug: erikaSlug,
          name: 'Dra. Érika Ettori',
          title: 'Advogada',
          bio: biography,
          education: [],
          experience: [],
          isActive: true,
          sortOrder: mario.sortOrder,
        }),
      );
      await cms.createProfessional(profile, actor);
    }

    console.log('Perfis conferidos no CMS local.');
  } finally {
    await db.$disconnect();
  }
}

void main().catch(() => {
  console.error('Não foi possível atualizar os perfis no CMS local.');
  process.exitCode = 1;
});
