import {
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  BadRequestException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { ApiEnvironment } from '@filaretti/config';
import type { Request } from 'express';
import { Webhook } from 'svix';
import { PrismaService } from '../database/prisma.service';
import { DOMAIN_ENVIRONMENT } from '../domain/shared';

@Controller('webhooks/resend')
export class ResendWebhookController {
  constructor(
    private readonly db: PrismaService,
    @Inject(DOMAIN_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}
  @Post()
  @HttpCode(200)
  async receive(@Req() request: RawBodyRequest<Request>) {
    const secret = this.environment.RESEND_WEBHOOK_SECRET;
    if (
      !secret ||
      !request.rawBody ||
      (!this.environment.RESEND_ENABLED && !this.environment.MOCK_INTEGRATIONS)
    )
      throw new UnauthorizedException({ code: 'INVALID_WEBHOOK' });
    const id = request.get('svix-id') ?? '';
    if (!/^[a-zA-Z0-9_-]{1,160}$/u.test(id))
      throw new UnauthorizedException({ code: 'INVALID_WEBHOOK' });
    let event: unknown;
    try {
      new Webhook(secret).verify(request.rawBody, {
        'svix-id': id,
        'svix-timestamp': request.get('svix-timestamp') ?? '',
        'svix-signature': request.get('svix-signature') ?? '',
      });
      event = JSON.parse(request.rawBody.toString('utf8')) as unknown;
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_WEBHOOK' });
    }
    if (
      !event ||
      typeof event !== 'object' ||
      !('type' in event) ||
      typeof event.type !== 'string' ||
      !/^email\.[a-z_]{1,60}$/u.test(event.type)
    )
      throw new BadRequestException({ code: 'INVALID_WEBHOOK_EVENT' });
    const data = 'data' in event ? event.data : undefined;
    const emailId =
      data &&
      typeof data === 'object' &&
      'email_id' in data &&
      typeof data.email_id === 'string' &&
      /^[a-zA-Z0-9_-]{1,160}$/u.test(data.email_id)
        ? data.email_id
        : null;
    await this.db.mailWebhookEvent.createMany({
      data: { id, type: event.type, emailId },
      skipDuplicates: true,
    });
    return { received: true };
  }
}
