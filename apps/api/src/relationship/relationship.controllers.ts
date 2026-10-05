import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthenticationGuard, Roles, RolesGuard } from '../auth/guards';
import type { AuthenticatedRequest } from '../auth/types';
import { VersionDto } from '../domain/dto';
import { PDF_LIMIT, type UploadedFile } from '../cms/upload';
import {
  ContactDto,
  ContactQueryDto,
  ContactStatusDto,
  NewsletterSubscribeDto,
  NewsletterTokenDto,
  SubscriberQueryDto,
} from './dto';
import { RelationshipPublicGuard } from './public.guard';
import { CONTACT_FILE_COUNT_LIMIT, RelationshipService } from './relationship.service';
import type { ApiEnvironment } from '@filaretti/config';
import { DOMAIN_ENVIRONMENT } from '../domain/shared';
import { resolveClientIp } from '../common/client-ip';

const uuid = new ParseUUIDPipe();

@ApiTags('Relacionamento público')
@UseGuards(RelationshipPublicGuard)
@Controller('public')
export class PublicRelationshipController {
  constructor(
    private readonly relationship: RelationshipService,
    @Inject(DOMAIN_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}

  @Post('contact')
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'name',
        'email',
        'subject',
        'message',
        'privacyAccepted',
        'turnstileToken',
        'idempotencyKey',
      ],
      properties: {
        name: { type: 'string', maxLength: 160 },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string', maxLength: 40 },
        state: { type: 'string', maxLength: 2 },
        practiceAreaId: { type: 'string', format: 'uuid' },
        subject: { type: 'string', maxLength: 200 },
        message: { type: 'string', maxLength: 10000 },
        privacyAccepted: { type: 'boolean', enum: [true] },
        newsletterConsent: { type: 'boolean' },
        turnstileToken: { type: 'string' },
        idempotencyKey: { type: 'string', format: 'uuid' },
        attachments: {
          type: 'array',
          maxItems: CONTACT_FILE_COUNT_LIMIT,
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('attachments', CONTACT_FILE_COUNT_LIMIT, {
      limits: {
        fileSize: PDF_LIMIT,
        files: CONTACT_FILE_COUNT_LIMIT,
        fields: 12,
        fieldSize: 10000,
        parts: 15,
      },
    }),
  )
  contact(
    @Body() dto: ContactDto,
    @UploadedFiles() files: UploadedFile[] | undefined,
    @Req() request: Request,
  ) {
    return this.relationship.contact(dto, files ?? [], resolveClientIp(request, this.environment));
  }

  @Post('newsletter/subscribe')
  @HttpCode(202)
  subscribe(@Body() dto: NewsletterSubscribeDto, @Req() request: Request) {
    return this.relationship.subscribe(dto, resolveClientIp(request, this.environment));
  }

  @Post('newsletter/confirm')
  @HttpCode(200)
  confirm(@Body() dto: NewsletterTokenDto) {
    return this.relationship.consumeNewsletterToken(dto.token, 'CONFIRM');
  }

  @Post('newsletter/unsubscribe')
  @HttpCode(200)
  unsubscribe(@Body() dto: NewsletterTokenDto) {
    return this.relationship.consumeNewsletterToken(dto.token, 'UNSUBSCRIBE');
  }
}

@ApiTags('Contatos administrativos')
@ApiCookieAuth('filaretti_access')
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/contacts')
export class AdminContactsController {
  constructor(private readonly relationship: RelationshipService) {}
  @Get() list(@Query() query: ContactQueryDto) {
    return this.relationship.contacts(query);
  }
  @Get(':id') detail(@Param('id', uuid) id: string) {
    return this.relationship.contactDetail(id);
  }
  @Patch(':id') status(
    @Param('id', uuid) id: string,
    @Body() dto: ContactStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.relationship.setContactStatus(id, dto, request.user);
  }
  @Delete(':id') remove(
    @Param('id', uuid) id: string,
    @Body() dto: VersionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.relationship.deleteContact(id, dto.version, request.user);
  }
  @Post(':id/attachments/:attachmentId/download-ticket')
  @HttpCode(200)
  ticket(
    @Param('id', uuid) id: string,
    @Param('attachmentId', uuid) attachmentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.relationship.issueDownload(id, attachmentId, request.user);
  }
}

@ApiTags('Downloads privados')
@ApiCookieAuth('filaretti_access')
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/contact-downloads')
export class AdminContactDownloadsController {
  constructor(private readonly relationship: RelationshipService) {}
  @Get(':token') async download(
    @Param('token') token: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const file = await this.relationship.download(token, request.user);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.bytes.length);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="anexo"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    );
    response.send(file.bytes);
  }
}

@ApiTags('Assinantes administrativos')
@ApiCookieAuth('filaretti_access')
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/subscribers')
export class AdminSubscribersController {
  constructor(private readonly relationship: RelationshipService) {}
  @Get() list(@Query() query: SubscriberQueryDto) {
    return this.relationship.subscribers(query);
  }
  @Get('export') async export(
    @Query() query: SubscriberQueryDto,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const csv = await this.relationship.exportSubscribers(query, request.user);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="assinantes.csv"');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(csv);
  }
  @Delete(':id') remove(
    @Param('id', uuid) id: string,
    @Body() dto: VersionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.relationship.deleteSubscriber(id, dto.version, request.user);
  }
}
