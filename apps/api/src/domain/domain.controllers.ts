import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthenticationGuard, RolesGuard, Roles } from '../auth/guards';
import type { AuthenticatedRequest } from '../auth/types';
import { ArticlesService } from './articles.service';
import { InstitutionService } from './institution.service';
import {
  AdminArticleQueryDto,
  ArticleDto,
  ArticlePatchDto,
  ArticleQueryDto,
  FaqDto,
  FaqPatchDto,
  FaqQueryDto,
  PageDto,
  PagePatchDto,
  PaginationDto,
  PracticeAreaDto,
  PracticeAreaPatchDto,
  ProfessionalDto,
  ProfessionalPatchDto,
  PublicationDto,
  RedirectDto,
  RedirectPatchDto,
  SettingsPatchDto,
  TaxonomyDto,
  TaxonomyPatchDto,
  VersionDto,
} from './dto';
import {
  adminArticleSchema,
  adminAreaSchema,
  adminFaqSchema,
  adminPageSchema,
  adminProfessionalSchema,
  adminRedirectSchema,
  adminSettingsSchema,
  adminTaxonomySchema,
  areaSchema,
  articleSchema,
  articleSummarySchema,
  deletedSchema,
  faqSchema,
  listSchema,
  pageSchema,
  professionalSchema,
  redirectSchema,
  settingsSchema,
  taxonomySchema,
} from './responses';

const uuid = new ParseUUIDPipe();
const taxonomyKinds = { categories: 'categories', tags: 'tags' };
const kindPipe = new ParseEnumPipe(taxonomyKinds);
const taxonomyKind = (kind: 'categories' | 'tags') => (kind === 'categories' ? 'category' : 'tag');

@ApiTags('Artigos públicos')
@Controller('articles')
export class PublicArticlesController {
  constructor(private readonly articles: ArticlesService) {}
  @Get() @ApiOkResponse({ schema: listSchema(articleSummarySchema) }) list(
    @Query() query: ArticleQueryDto,
  ) {
    return this.articles.publicList(query);
  }
  @Get(':slug') @ApiOkResponse({ schema: articleSchema }) detail(@Param('slug') slug: string) {
    return this.articles.publicDetail(slug);
  }
}
@ApiTags('Artigos administrativos')
@ApiCookieAuth('filaretti_access')
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR)
@Controller('admin/articles')
export class AdminArticlesController {
  constructor(private readonly articles: ArticlesService) {}
  @Get() @ApiOkResponse({ schema: listSchema(adminArticleSchema) }) list(
    @Query() query: AdminArticleQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.articles.adminList(query, request.user);
  }
  @Get(':id') @ApiOkResponse({ schema: adminArticleSchema }) detail(
    @Param('id', uuid) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.articles.adminDetail(id, request.user);
  }
  @Post() @ApiCreatedResponse({ schema: adminArticleSchema }) create(
    @Body() dto: ArticleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.articles.create(dto, request.user);
  }
  @Patch(':id') @ApiOkResponse({ schema: adminArticleSchema }) update(
    @Param('id', uuid) id: string,
    @Body() dto: ArticlePatchDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.articles.update(id, dto, request.user);
  }
  @Post(':id/publication')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiCreatedResponse({ schema: adminArticleSchema })
  publish(
    @Param('id', uuid) id: string,
    @Body() dto: PublicationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.articles.publication(id, dto, request.user);
  }
  @Delete(':id') @ApiOkResponse({ schema: deletedSchema }) remove(
    @Param('id', uuid) id: string,
    @Body() dto: VersionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.articles.remove(id, dto.version, request.user);
  }
}
@ApiTags('Taxonomias públicas')
@Controller('taxonomies')
export class PublicTaxonomiesController {
  constructor(private readonly institution: InstitutionService) {}
  @Get(':kind') @ApiOkResponse({ schema: listSchema(taxonomySchema) }) list(
    @Param('kind', kindPipe) kind: 'categories' | 'tags',
    @Query() query: PaginationDto,
  ) {
    return this.institution.listTaxonomies(taxonomyKind(kind), query);
  }
  @Get(':kind/:slug') @ApiOkResponse({ schema: taxonomySchema }) detail(
    @Param('kind', kindPipe) kind: 'categories' | 'tags',
    @Param('slug') slug: string,
  ) {
    return this.institution.taxonomyDetail(taxonomyKind(kind), slug);
  }
}
@ApiTags('Taxonomias administrativas')
@ApiCookieAuth('filaretti_access')
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.EDITOR)
@Controller('admin/taxonomies')
export class AdminTaxonomiesController {
  constructor(private readonly institution: InstitutionService) {}
  @Get(':kind') @ApiOkResponse({ schema: listSchema(adminTaxonomySchema) }) list(
    @Param('kind', kindPipe) kind: 'categories' | 'tags',
    @Query() query: PaginationDto,
  ) {
    return this.institution.listTaxonomies(taxonomyKind(kind), query, true);
  }
  @Get(':kind/:id') @ApiOkResponse({ schema: adminTaxonomySchema }) detail(
    @Param('kind', kindPipe) kind: 'categories' | 'tags',
    @Param('id', uuid) id: string,
  ) {
    return this.institution.taxonomyDetail(taxonomyKind(kind), id, true);
  }
  @Post(':kind') @ApiCreatedResponse({ schema: adminTaxonomySchema }) create(
    @Param('kind', kindPipe) kind: 'categories' | 'tags',
    @Body() dto: TaxonomyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.createTaxonomy(taxonomyKind(kind), dto, request.user);
  }
  @Patch(':kind/:id') @ApiOkResponse({ schema: adminTaxonomySchema }) update(
    @Param('kind', kindPipe) kind: 'categories' | 'tags',
    @Param('id', uuid) id: string,
    @Body() dto: TaxonomyPatchDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.updateTaxonomy(taxonomyKind(kind), id, dto, request.user);
  }
  @Delete(':kind/:id') @ApiOkResponse({ schema: deletedSchema }) remove(
    @Param('kind', kindPipe) kind: 'categories' | 'tags',
    @Param('id', uuid) id: string,
    @Body() dto: VersionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.removeTaxonomy(taxonomyKind(kind), id, dto.version, request.user);
  }
}
@ApiTags('Institucional público')
@Controller()
export class PublicInstitutionController {
  constructor(private readonly institution: InstitutionService) {}
  @Get('professionals') @ApiOkResponse({ schema: listSchema(professionalSchema) }) professionals(
    @Query() query: PaginationDto,
  ) {
    return this.institution.professionals(query);
  }
  @Get('professionals/:slug') @ApiOkResponse({ schema: professionalSchema }) professional(
    @Param('slug') slug: string,
  ) {
    return this.institution.professionalDetail(slug);
  }
  @Get('practice-areas') @ApiOkResponse({ schema: listSchema(areaSchema) }) areas(
    @Query() query: PaginationDto,
  ) {
    return this.institution.areas(query);
  }
  @Get('practice-areas/:slug') @ApiOkResponse({ schema: areaSchema }) area(
    @Param('slug') slug: string,
  ) {
    return this.institution.areaDetail(slug);
  }
  @Get('pages') @ApiOkResponse({ schema: listSchema(pageSchema) }) pages(
    @Query() query: PaginationDto,
  ) {
    return this.institution.pages(query);
  }
  @Get('pages/:slug') @ApiOkResponse({ schema: pageSchema }) page(@Param('slug') slug: string) {
    return this.institution.pageDetail(slug);
  }
  @Get('faqs') @ApiOkResponse({ schema: listSchema(faqSchema) }) faqs(@Query() query: FaqQueryDto) {
    return this.institution.faqs(query);
  }
  @Get('faqs/:id') @ApiOkResponse({ schema: faqSchema }) faq(@Param('id', uuid) id: string) {
    return this.institution.faqDetail(id);
  }
  @Get('settings') @ApiOkResponse({ schema: settingsSchema }) settings() {
    return this.institution.settings();
  }
  @Get('redirects') @ApiOkResponse({ schema: listSchema(redirectSchema) }) redirects(
    @Query() query: PaginationDto,
  ) {
    return this.institution.redirects(query);
  }
}
@ApiTags('Institucional administrativo')
@ApiCookieAuth('filaretti_access')
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.EDITOR)
@Controller('admin')
export class AdminInstitutionController {
  constructor(private readonly institution: InstitutionService) {}
  @Get('professionals')
  @ApiOkResponse({ schema: listSchema(adminProfessionalSchema) })
  professionals(@Query() query: PaginationDto) {
    return this.institution.professionals(query, true);
  }
  @Get('professionals/:id') @ApiOkResponse({ schema: adminProfessionalSchema }) professional(
    @Param('id', uuid) id: string,
  ) {
    return this.institution.professionalDetail(id, true);
  }
  @Post('professionals')
  @ApiCreatedResponse({ schema: adminProfessionalSchema })
  createProfessional(@Body() dto: ProfessionalDto, @Req() request: AuthenticatedRequest) {
    return this.institution.createProfessional(dto, request.user);
  }
  @Patch('professionals/:id')
  @ApiOkResponse({ schema: adminProfessionalSchema })
  updateProfessional(
    @Param('id', uuid) id: string,
    @Body() dto: ProfessionalPatchDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.updateProfessional(id, dto, request.user);
  }
  @Delete('professionals/:id') @ApiOkResponse({ schema: deletedSchema }) removeProfessional(
    @Param('id', uuid) id: string,
    @Body() dto: VersionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.removeProfessional(id, dto.version, request.user);
  }
  @Get('practice-areas') @ApiOkResponse({ schema: listSchema(adminAreaSchema) }) areas(
    @Query() query: PaginationDto,
  ) {
    return this.institution.areas(query, true);
  }
  @Get('practice-areas/:id') @ApiOkResponse({ schema: adminAreaSchema }) area(
    @Param('id', uuid) id: string,
  ) {
    return this.institution.areaDetail(id, true);
  }
  @Post('practice-areas') @ApiCreatedResponse({ schema: adminAreaSchema }) createArea(
    @Body() dto: PracticeAreaDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.createArea(dto, request.user);
  }
  @Patch('practice-areas/:id') @ApiOkResponse({ schema: adminAreaSchema }) updateArea(
    @Param('id', uuid) id: string,
    @Body() dto: PracticeAreaPatchDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.updateArea(id, dto, request.user);
  }
  @Delete('practice-areas/:id') @ApiOkResponse({ schema: deletedSchema }) removeArea(
    @Param('id', uuid) id: string,
    @Body() dto: VersionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.removeArea(id, dto.version, request.user);
  }
  @Get('pages') @ApiOkResponse({ schema: listSchema(adminPageSchema) }) pages(
    @Query() query: PaginationDto,
  ) {
    return this.institution.pages(query, true);
  }
  @Get('pages/:id') @ApiOkResponse({ schema: adminPageSchema }) page(
    @Param('id', uuid) id: string,
  ) {
    return this.institution.pageDetail(id, true);
  }
  @Post('pages') @ApiCreatedResponse({ schema: adminPageSchema }) createPage(
    @Body() dto: PageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.createPage(dto, request.user);
  }
  @Patch('pages/:id') @ApiOkResponse({ schema: adminPageSchema }) updatePage(
    @Param('id', uuid) id: string,
    @Body() dto: PagePatchDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.updatePage(id, dto, request.user);
  }
  @Post('pages/:id/publication') @ApiCreatedResponse({ schema: adminPageSchema }) publishPage(
    @Param('id', uuid) id: string,
    @Body() dto: PublicationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.publishPage(id, dto, request.user);
  }
  @Delete('pages/:id') @ApiOkResponse({ schema: deletedSchema }) removePage(
    @Param('id', uuid) id: string,
    @Body() dto: VersionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.removePage(id, dto.version, request.user);
  }
  @Get('faqs') @ApiOkResponse({ schema: listSchema(adminFaqSchema) }) faqs(
    @Query() query: FaqQueryDto,
  ) {
    return this.institution.faqs(query, true);
  }
  @Get('faqs/:id') @ApiOkResponse({ schema: adminFaqSchema }) faq(@Param('id', uuid) id: string) {
    return this.institution.faqDetail(id, true);
  }
  @Post('faqs') @ApiCreatedResponse({ schema: adminFaqSchema }) createFaq(
    @Body() dto: FaqDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.createFaq(dto, request.user);
  }
  @Patch('faqs/:id') @ApiOkResponse({ schema: adminFaqSchema }) updateFaq(
    @Param('id', uuid) id: string,
    @Body() dto: FaqPatchDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.updateFaq(id, dto, request.user);
  }
  @Delete('faqs/:id') @ApiOkResponse({ schema: deletedSchema }) removeFaq(
    @Param('id', uuid) id: string,
    @Body() dto: VersionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.removeFaq(id, dto.version, request.user);
  }
  @Get('settings')
  @Roles(UserRole.ADMIN)
  @ApiOkResponse({ schema: adminSettingsSchema })
  settings() {
    return this.institution.settings(true);
  }
  @Patch('settings')
  @Roles(UserRole.ADMIN)
  @ApiOkResponse({ schema: adminSettingsSchema })
  updateSettings(@Body() dto: SettingsPatchDto, @Req() request: AuthenticatedRequest) {
    return this.institution.updateSettings(dto, request.user);
  }
  @Get('redirects')
  @Roles(UserRole.ADMIN)
  @ApiOkResponse({ schema: listSchema(adminRedirectSchema) })
  redirects(@Query() query: PaginationDto) {
    return this.institution.redirects(query, true);
  }
  @Get('redirects/:id')
  @Roles(UserRole.ADMIN)
  @ApiOkResponse({ schema: adminRedirectSchema })
  redirect(@Param('id', uuid) id: string) {
    return this.institution.redirectDetail(id);
  }
  @Post('redirects')
  @Roles(UserRole.ADMIN)
  @ApiCreatedResponse({ schema: adminRedirectSchema })
  createRedirect(@Body() dto: RedirectDto, @Req() request: AuthenticatedRequest) {
    return this.institution.createRedirect(dto, request.user);
  }
  @Patch('redirects/:id')
  @Roles(UserRole.ADMIN)
  @ApiOkResponse({ schema: adminRedirectSchema })
  updateRedirect(
    @Param('id', uuid) id: string,
    @Body() dto: RedirectPatchDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.updateRedirect(id, dto, request.user);
  }
  @Delete('redirects/:id')
  @Roles(UserRole.ADMIN)
  @ApiOkResponse({ schema: deletedSchema })
  removeRedirect(
    @Param('id', uuid) id: string,
    @Body() dto: VersionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.institution.removeRedirect(id, dto.version, request.user);
  }
}
