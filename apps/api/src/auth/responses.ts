import type { SchemaObject } from '@nestjs/swagger';

export const safeUserSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'email', 'name', 'role', 'isActive'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string' },
    role: { type: 'string', enum: ['ADMIN', 'EDITOR', 'AUTHOR'] },
    isActive: { type: 'boolean' },
  },
};
export const csrfSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['csrfToken'],
  properties: {
    csrfToken: { type: 'string', description: 'Proteção CSRF, sem credencial de sessão.' },
  },
};
export const authenticationSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['user', 'csrfToken'],
  properties: { user: safeUserSchema, csrfToken: csrfSchema.properties!.csrfToken! },
};
export const recoverySchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['message'],
  properties: { message: { type: 'string' } },
};
export const userListSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['data', 'meta'],
  properties: {
    data: { type: 'array', items: safeUserSchema },
    meta: {
      type: 'object',
      required: ['page', 'limit', 'total', 'pages'],
      additionalProperties: false,
      properties: {
        page: { type: 'integer' },
        limit: { type: 'integer' },
        total: { type: 'integer' },
        pages: { type: 'integer' },
      },
    },
  },
};
