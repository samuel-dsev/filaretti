import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { ApiEnvironment } from '@filaretti/config';

export interface TransactionalMail {
  kind: 'contact' | 'newsletter-confirm' | 'newsletter-unsubscribe' | 'recovery';
  recipient: string;
  token?: string;
  contactId?: string;
  expiresAt?: string;
}
function key(environment: ApiEnvironment) {
  if (environment.MAIL_ENCRYPTION_KEY) return Buffer.from(environment.MAIL_ENCRYPTION_KEY, 'hex');
  if (environment.APP_ENV === 'development' && environment.MOCK_INTEGRATIONS)
    return createHash('sha256').update(environment.PREVIEW_SECRET).digest();
  throw new Error('MAIL_CONFIGURATION_REQUIRED');
}
export function encryptMail(
  environment: ApiEnvironment,
  input: TransactionalMail,
  idempotencyKey: string,
): Prisma.InputJsonObject {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(environment), iv);
  cipher.setAAD(Buffer.from(idempotencyKey));
  const data = Buffer.concat([cipher.update(JSON.stringify(input), 'utf8'), cipher.final()]);
  return {
    version: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
}
export function decryptMail(
  environment: ApiEnvironment,
  payload: unknown,
  idempotencyKey: string,
): TransactionalMail {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    throw new Error('INVALID_MAIL');
  const envelope = payload as Record<string, unknown>;
  if (
    envelope.version !== 1 ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.tag !== 'string' ||
    typeof envelope.data !== 'string'
  )
    throw new Error('INVALID_MAIL');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key(environment),
    Buffer.from(envelope.iv, 'base64'),
  );
  decipher.setAAD(Buffer.from(idempotencyKey));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const input: unknown = JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(envelope.data, 'base64')),
      decipher.final(),
    ]).toString('utf8'),
  );
  if (
    !input ||
    typeof input !== 'object' ||
    !('kind' in input) ||
    !['contact', 'newsletter-confirm', 'newsletter-unsubscribe', 'recovery'].includes(
      String(input.kind),
    ) ||
    !('recipient' in input) ||
    typeof input.recipient !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(input.recipient)
  )
    throw new Error('INVALID_MAIL');
  const fields = input as Record<string, unknown>;
  for (const name of ['token', 'contactId', 'expiresAt'] as const)
    if (name in fields && typeof fields[name] !== 'string') throw new Error('INVALID_MAIL');
  return input as TransactionalMail;
}
export async function queueEmail(
  tx: Prisma.TransactionClient,
  environment: ApiEnvironment,
  input: TransactionalMail,
  idempotencyKey: string,
) {
  return tx.outboxTask.create({
    data: {
      topic: 'mail.send',
      idempotencyKey,
      payload: encryptMail(environment, input, idempotencyKey),
    },
  });
}

export function renderTransactionalMail(environment: ApiEnvironment, mail: TransactionalMail) {
  const link = (path: string) => {
    if (!mail.token || !/^[a-f0-9]{64}$/u.test(mail.token)) throw new Error('INVALID_MAIL');
    const url = new URL(path, environment.WEB_PUBLIC_URL);
    url.hash = `token=${mail.token}`;
    return url.href;
  };
  switch (mail.kind) {
    case 'contact':
      return {
        subject: 'Nova solicitação de contato',
        text: `Uma solicitação foi recebida. Consulte os dados e anexos exclusivamente no painel administrativo: ${new URL('/admin/contatos', environment.WEB_PUBLIC_URL).href}`,
      };
    case 'newsletter-confirm':
      return {
        subject: 'Confirme sua inscrição',
        text: `Confirme a inscrição solicitada: ${link('/newsletter/confirmar')}\nSe não solicitou, ignore esta mensagem.`,
      };
    case 'newsletter-unsubscribe':
      return mail.token
        ? {
            subject: 'Inscrição confirmada e preferências',
            text: `Sua inscrição foi confirmada. Você pode encerrá-la a qualquer momento: ${link('/newsletter/descadastrar')}`,
          }
        : {
            subject: 'Descadastro confirmado',
            text: 'Seu descadastro foi concluído. Você não receberá mensagens de newsletter. Uma nova inscrição exigirá nova confirmação.',
          };
    case 'recovery':
      return {
        subject: 'Redefina sua senha',
        text: `Redefina sua senha pelo link de uso único: ${link('/admin/redefinir-senha')}\nSe não solicitou, ignore esta mensagem.`,
      };
  }
}
