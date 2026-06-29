import { NextResponse } from 'next/server'
import { API_SCOPES } from '@/lib/apikeys'

// GET /api/v1/openapi.json — machine-readable OpenAPI 3.1 description of the public API.
export async function GET() {
  const doc = {
    openapi: '3.1.0',
    info: {
      title: 'Remote Classroom Desktop API',
      version: '1.0.0',
      description:
        'Programmatic access to classes, rosters and desktops. Authenticate with a scoped API key as ' +
        '`Authorization: Bearer rcd_sk_...`. Mint keys in the teacher admin console.',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'rcd_sk' },
      },
      schemas: {
        Class: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            joinCode: { type: 'string' },
            defaultOs: { type: 'string', enum: ['linux', 'windows'] },
            defaultDurationMin: { type: 'integer' },
            allowStudentBoot: { type: 'boolean' },
            studentCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    'x-scopes': API_SCOPES,
    paths: {
      '/classes': {
        get: {
          summary: 'List your classes',
          'x-required-scope': 'classes:read',
          responses: {
            '200': { description: 'OK' },
            '401': { description: 'Missing/invalid key' },
            '403': { description: 'Missing scope' },
            '429': { description: 'Rate limited' },
          },
        },
        post: {
          summary: 'Create a class',
          'x-required-scope': 'classes:write',
          responses: { '201': { description: 'Created' }, '402': { description: 'Plan limit' } },
        },
      },
      '/classes/{id}/roster': {
        get: { summary: 'List a class roster', 'x-required-scope': 'roster:read', responses: { '200': { description: 'OK' } } },
        put: { summary: 'Bulk-enroll students by name (idempotent)', 'x-required-scope': 'roster:write', responses: { '200': { description: 'OK' } } },
      },
      '/students/{studentId}/boot': {
        post: { summary: "Boot a student's (or their group's) desktop", 'x-required-scope': 'desktops:write', responses: { '200': { description: 'OK' } } },
      },
      '/machines/{machineId}/stop': {
        post: { summary: 'Stop a running desktop', 'x-required-scope': 'desktops:write', responses: { '200': { description: 'OK' } } },
      },
      '/activity': {
        get: { summary: 'Recent activity events', 'x-required-scope': 'activity:read', responses: { '200': { description: 'OK' } } },
      },
    },
  }
  return NextResponse.json(doc)
}
