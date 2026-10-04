import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { AuthenticationGuard, Roles, RolesGuard } from '../auth/guards';
import type { AuthenticatedRequest } from '../auth/types';
import { VersionDto } from '../domain/dto';
import { ArticlesService } from '../domain/articles.service';
import { MediaService } from './media.service';
import { MediaPatchDto, MediaQueryDto, MediaUploadDto } from './dto';
import type { UploadedFile as File } from './upload';
import { PDF_LIMIT } from './upload';

const uuid = new ParseUUIDPipe();
@ApiTags('Biblioteca de mídia')
@ApiCookieAuth('filaretti_access')
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR)
@Controller('admin/media')
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}
  @Get() list(@Query() query: MediaQueryDto, @Req() request: AuthenticatedRequest) {
    return this.media.list(query, request.user);
  }
  @Get(':id') detail(@Param('id', uuid) id: string, @Req() request: AuthenticatedRequest) {
    return this.media.detail(id, request.user);
  }
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        alt: { type: 'string' },
        source: { type: 'string' },
        license: { type: 'string' },
        visibility: { type: 'string', enum: ['PUBLIC', 'PRIVATE'] },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: PDF_LIMIT, files: 1, fields: 4, fieldSize: 1000, parts: 5 },
    }),
  )
  upload(
    @UploadedFile() file: File | undefined,
    @Body() dto: MediaUploadDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.media.upload(file, dto, request.user);
  }
  @Patch(':id') update(
    @Param('id', uuid) id: string,
    @Body() dto: MediaPatchDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.media.update(id, dto, request.user);
  }
  @Delete(':id') remove(
    @Param('id', uuid) id: string,
    @Body() dto: VersionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.media.remove(id, dto.version, request.user);
  }
}
@ApiTags('Mídia editorial pública')
@Controller('media/public')
export class PublicMediaController {
  constructor(private readonly media: MediaService) {}
  @Get(':key') async asset(@Param('key') key: string, @Res() response: Response) {
    const asset = await this.media.publicAsset(key);
    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Content-Length', asset.bytes.length);
    response.setHeader(
      'Content-Disposition',
      asset.mimeType === 'application/pdf' ? `attachment; filename="${key}"` : 'inline',
    );
    response.send(asset.bytes);
  }
}
@ApiTags('Preview privado')
@Controller('preview')
export class PublicPreviewController {
  constructor(private readonly articles: ArticlesService) {}
  @Get(':token') preview(
    @Param('token') token: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return this.articles.preview(token);
  }
}
