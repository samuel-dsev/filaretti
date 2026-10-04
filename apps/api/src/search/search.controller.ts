import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { listSchema } from '../domain/responses';
import { PublicSearchDto, SearchPaginationDto } from './dto';
import { SearchService } from './search.service';

@ApiTags('Busca e sitemap públicos')
@Controller('public')
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get('search')
  @ApiOkResponse({
    schema: listSchema({
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'slug', 'title', 'excerpt', 'href'],
      properties: {
        kind: { type: 'string', enum: ['article', 'area', 'professional'] },
        slug: { type: 'string' },
        title: { type: 'string' },
        excerpt: { type: 'string' },
        href: { type: 'string' },
      },
    }),
  })
  search(@Query() query: PublicSearchDto) {
    return this.service.search(query);
  }

  @Get('sitemap')
  @ApiOkResponse({
    schema: listSchema({
      type: 'object',
      additionalProperties: false,
      required: ['path', 'updatedAt'],
      properties: { path: { type: 'string' }, updatedAt: { type: 'string', format: 'date-time' } },
    }),
  })
  sitemap(@Query() query: SearchPaginationDto) {
    return this.service.sitemap(query);
  }
}
