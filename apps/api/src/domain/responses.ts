import type { SchemaObject } from '@nestjs/swagger';
const string: SchemaObject = { type: 'string' };
const nullableString: SchemaObject = { type: 'string', nullable: true };
const integer: SchemaObject = { type: 'integer' };
const boolean: SchemaObject = { type: 'boolean' };
const array = (items: SchemaObject): SchemaObject => ({ type: 'array', items });
const object = (
  properties: Record<string, SchemaObject>,
  optional: string[] = [],
): SchemaObject => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required: Object.keys(properties).filter((key) => !optional.includes(key)),
});
const nullable = (schema: SchemaObject): SchemaObject => ({ ...schema, nullable: true });
export const documentSchema: SchemaObject = {
  type: 'object',
  description: 'TipTap doc do schema permitido, documentado em docs/api.md.',
  required: ['type', 'content'],
  properties: {
    type: { type: 'string', enum: ['doc'] },
    content: { type: 'array', items: { type: 'object' } },
  },
  additionalProperties: false,
};
const mediaSchema = object({
  id: string,
  alt: nullableString,
  mimeType: string,
  size: integer,
  url: string,
});
export const taxonomySchema = object({ id: string, slug: string, name: string });
export const editorialFiltersSchema = object({
  areas: array(taxonomySchema),
  categories: array(taxonomySchema),
  authors: array(taxonomySchema),
  tags: array(taxonomySchema),
  years: array(integer),
});
const professionalSummarySchema = object({
  id: string,
  slug: string,
  name: string,
  title: string,
  photo: nullable(mediaSchema),
});
export const professionalSchema = object({
  ...professionalSummarySchema.properties,
  bio: documentSchema,
  education: array(string),
  experience: array(string),
  practiceAreas: array(taxonomySchema),
});
export const areaSchema = object({
  ...taxonomySchema.properties,
  summary: string,
  description: documentSchema,
  services: array(string),
  professionals: array(professionalSummarySchema),
});
export const articleSummarySchema = object({
  id: string,
  slug: string,
  title: string,
  excerpt: string,
  type: { type: 'string', enum: ['ARTICLE', 'UPDATE', 'GUIDE'] },
  featured: boolean,
  publishedAt: string,
  updatedAt: string,
  readingTimeMinutes: integer,
  author: nullable(professionalSummarySchema),
  cover: nullable(mediaSchema),
  categories: array(taxonomySchema),
  tags: array(taxonomySchema),
  practiceAreas: array(taxonomySchema),
});
export const articleSchema = object({
  ...articleSummarySchema.properties,
  content: documentSchema,
  pdf: nullable(mediaSchema),
  seoTitle: nullableString,
  seoDescription: nullableString,
});
export const pageSchema = object({
  id: string,
  slug: string,
  title: string,
  sections: array(object({ key: string, heading: string, body: documentSchema }, ['heading'])),
  seoTitle: nullableString,
  seoDescription: nullableString,
});
export const faqSchema = object({
  id: string,
  question: string,
  answer: documentSchema,
  practiceArea: nullable(taxonomySchema),
});
export const settingsSchema = object({
  siteName: string,
  publicEmail: nullableString,
  publicPhone: nullableString,
  whatsappUrl: nullableString,
  address: object(
    { street: string, city: string, state: string, postalCode: string, country: string },
    ['street', 'city', 'state', 'postalCode', 'country'],
  ),
  socialLinks: array(object({ label: string, url: string })),
});
export const redirectSchema = object({
  sourcePath: string,
  targetPath: string,
  statusCode: integer,
});
export const deletedSchema = object({ deleted: { type: 'boolean', enum: [true] } });
export function listSchema(schema: SchemaObject): SchemaObject {
  return object({
    data: array(schema),
    meta: object({ page: integer, limit: integer, total: integer, pages: integer }),
  });
}
export function adminSchema(
  schema: SchemaObject,
  extra: Record<string, SchemaObject> = {},
): SchemaObject {
  return object({ ...schema.properties, version: integer, ...extra });
}
export const adminArticleSchema = adminSchema(articleSchema, {
  status: { type: 'string', enum: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] },
  createdById: string,
  updatedById: nullableString,
  authorId: string,
  coverMediaId: nullableString,
  pdfMediaId: nullableString,
  categoryIds: array(string),
  tagIds: array(string),
  practiceAreaIds: array(string),
  scheduledAt: nullableString,
  createdAt: string,
  isMock: boolean,
  publishedAt: nullableString,
});
export const adminTaxonomySchema = adminSchema(taxonomySchema, {
  isActive: boolean,
  isMock: boolean,
});
export const adminProfessionalSchema = adminSchema(professionalSchema, {
  photoMediaId: nullableString,
  practiceAreaIds: array(string),
  isActive: boolean,
  sortOrder: integer,
  isMock: boolean,
});
export const adminAreaSchema = adminSchema(areaSchema, {
  isActive: boolean,
  sortOrder: integer,
  isMock: boolean,
});
export const adminPageSchema = adminSchema(pageSchema, {
  status: { type: 'string', enum: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] },
  isMock: boolean,
  publishedAt: nullableString,
});
export const adminFaqSchema = adminSchema(faqSchema, {
  practiceAreaId: nullableString,
  isActive: boolean,
  sortOrder: integer,
  isMock: boolean,
});
export const adminSettingsSchema = adminSchema(settingsSchema, { isMock: boolean });
export const adminRedirectSchema = adminSchema(redirectSchema, { id: string, isActive: boolean });
