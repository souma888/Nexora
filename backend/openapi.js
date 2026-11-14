import { labManifest } from './lab-manifest.js';

function fieldSchema(field) {
  if (['list', 'edges', 'words', 'commands'].includes(field.type))
    return {
      type: 'string',
      maxLength:
        field.type === 'commands'
          ? 700
          : field.type === 'edges'
            ? 600
            : field.type === 'words'
              ? 100
              : 300,
      description:
        field.type === 'list'
          ? `Comma-separated integers: 1–${field.maxItems} in [${field.min},${field.max}].`
          : field.type === 'commands'
            ? `Up to ${field.maxItems} semicolon-separated commands. Allowed commands and arities: ${JSON.stringify(field.commands)}.`
            : field.type === 'words'
              ? '1–8 comma-separated lowercase words, 1–8 letters each.'
              : `Up to ${field.maxItems} from,to,weight edges; nodes 0–5, weights [${field.min},${field.max}].`,
    };
  if (field.type === 'integer') return { type: 'integer', minimum: field.min, maximum: field.max };
  if (field.type === 'string')
    return {
      type: 'string',
      maxLength: field.maxLength ?? 2000,
      description: `${field.format ?? 'Model-specific text'}. ${field.format === 'comma-separated-integers' ? `Use ${field.minItems ?? 1}–${field.maxItems} integers in [${field.itemMin},${field.itemMax}].` : ''}`,
    };
  if (field.type === 'enum') return { type: 'string', enum: field.options };
  if (field.type === 'text')
    return {
      type: 'string',
      minLength: 1,
      maxLength: field.maxLength,
      description: field.hint,
      pattern: field.pattern,
    };
  if (field.type === 'integer-list')
    return {
      type: 'string',
      maxLength: 300,
      description: `Comma-separated integers: 1–${field.maxItems} items in [${field.minItem},${field.maxItem}].`,
    };
  const numeric = {
    type: field.integer ? 'integer' : 'number',
    minimum: field.min,
    maximum: field.max,
  };
  return {
    oneOf: [
      numeric,
      {
        type: 'object',
        additionalProperties: false,
        required: ['value', 'unit'],
        properties: { value: { type: 'number' }, unit: { type: 'string', maxLength: 100 } },
      },
    ],
    description: `Canonical unit: ${field.unit || 'dimensionless'}. Quantity objects must have compatible dimensions; bounds apply after conversion.`,
  };
}
function inputSchema(definition) {
  if (!definition.inputs)
    return {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(definition.defaults ?? {}).map(([key, value]) => [
          key,
          { type: typeof value === 'number' ? 'number' : 'string' },
        ]),
      ),
      required: Object.keys(definition.defaults ?? {}),
      description:
        'Algorithm-specific bounds, graph syntax and invariants are validated by the module; see GET discovery metadata and model notes.',
    };
  return {
    type: 'object',
    properties: Object.fromEntries(
      Object.entries(definition.inputs).map(([key, field]) => [key, fieldSchema(field)]),
    ),
    required: Object.entries(definition.inputs)
      .filter(([, field]) => !field.visibleWhen)
      .map(([key]) => key),
    'x-validation-rules': definition.rules ?? [],
    'x-module-validation': Boolean(definition.validateValues),
    description:
      'Conditional fields use their declared default when hidden. Model-specific relational constraints can also produce HTTP 422.',
  };
}
const schemas = Object.fromEntries(
  labManifest.map(({ id, model }) => [id, inputSchema(model.definition)]),
);
const endpointModels = (endpoint) => labManifest.filter((entry) => entry.endpoint === endpoint);
const paths = Object.fromEntries(
  ['/api/beam', '/api/materials', '/api/waves', '/api/algorithms'].map((endpoint) => [
    endpoint,
    {
      get: {
        summary: 'Discover accepted model definitions, defaults, units and solver versions',
        responses: {
          200: {
            description: 'Model metadata',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['models'],
                  properties: { models: { type: 'array', items: { type: 'object' } } },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Validate inputs and evaluate a solver',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema:
                endpoint === '/api/beam'
                  ? { $ref: '#/components/schemas/beam' }
                  : {
                      oneOf: endpointModels(endpoint).map(({ id }) => ({
                        type: 'object',
                        required: ['model', 'input'],
                        properties: {
                          model: { const: id },
                          input: { $ref: `#/components/schemas/${id}` },
                        },
                      })),
                    },
            },
          },
        },
        responses: {
          200: {
            description:
              'Canonical inputs, units, solver version, summary and plot series; algorithm results include independent frames and stats.',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          400: {
            description: 'Malformed JSON',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          422: {
            description:
              'Unknown model, incompatible dimensions, invalid parameter or module constraint',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
  ]),
);
export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'Nexora Solver API',
    version: '1.0.0',
    description:
      'Pure educational solvers. Numbers use canonical units; physical quantity objects are supported on numeric fields. Validation and solver versions belong to each module.',
  },
  servers: [{ url: '/' }],
  paths: {
    ...paths,
    '/api/catalog': {
      get: {
        summary: 'Lab catalog and discipline metadata',
        responses: { 200: { description: 'Generated catalog' } },
      },
    },
    '/api/openapi': {
      get: {
        summary: 'This OpenAPI specification',
        responses: { 200: { description: 'OpenAPI 3.1 JSON' } },
      },
    },
  },
  components: {
    schemas: {
      ...schemas,
      Error: {
        type: 'object',
        required: ['error', 'code', 'field'],
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          field: { type: ['string', 'null'] },
        },
      },
    },
  },
};
