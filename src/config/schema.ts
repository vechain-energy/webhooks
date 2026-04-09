import { z } from 'zod';

const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'DELETE']);
const filterOperatorSchema = z.enum([
  'eq',
  'neq',
  'lt',
  'lte',
  'gt',
  'gte',
  'empty',
  'notEmpty',
  'in',
  'notIn'
]);

export const runtimeConfigSchema = z.object({
  version: z.literal(1),
  network: z.enum(['main', 'test']),
  nodeUrl: z.url(),
  server: z.object({
    port: z.number().int().positive().default(8080)
  }).default({ port: 8080 }),
  processing: z.object({
    confirmations: z.number().int().min(0).default(12),
    replayWindowBlocks: z.number().int().min(1).default(64)
  }).default({
    confirmations: 12,
    replayWindowBlocks: 64
  }),
  delivery: z.object({
    requestTimeoutMs: z.number().int().positive().default(10000),
    maxAttempts: z.number().int().min(1).default(5),
    initialBackoffMs: z.number().int().positive().default(1000),
    maxBackoffMs: z.number().int().positive().default(16000),
    defaultHeaders: z.record(z.string(), z.string()).default({}),
    signing: z.object({
      defaultEnabled: z.boolean().default(false),
      header: z.string().min(1).default('x-webhook-signature')
    }).default({
      defaultEnabled: false,
      header: 'x-webhook-signature'
    })
  }).default({
    requestTimeoutMs: 10000,
    maxAttempts: 5,
    initialBackoffMs: 1000,
    maxBackoffMs: 16000,
    defaultHeaders: {},
    signing: {
      defaultEnabled: false,
      header: 'x-webhook-signature'
    }
  }),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info')
});

const decodeFieldSchema = z.object({
  format: z.literal('ether').optional(),
  bytes: z.literal('utf8').optional()
}).refine(
  (value) => Boolean(value.format || value.bytes),
  'decode.fields entries must define at least one decode hint.'
);

const webhookEventSchema = z.object({
  name: z.string().min(1),
  abi: z.object({
    inline: z.unknown().optional(),
    file: z.string().min(1).optional()
  }).superRefine((value, ctx) => {
    const hasInline = value.inline !== undefined;
    const hasFile = Boolean(value.file);

    if (hasInline === hasFile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Event webhooks must define exactly one ABI source. Set either match.event.abi.inline or match.event.abi.file.'
      });
    }
  })
});

export const webhookConfigSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  enabled: z.boolean(),
  description: z.string().optional(),
  match: z.object({
    kind: z.enum(['event', 'transfer', 'transaction', 'clause']),
    addresses: z.array(z.string().min(1)).optional(),
    event: webhookEventSchema.optional()
  }).superRefine((value, ctx) => {
    if (value.kind === 'event' && !value.event) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Event webhooks must define match.event with an ABI source and event name.'
      });
    }

    if (value.kind !== 'event' && value.event) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Only event webhooks may define match.event. Remove match.event or change match.kind to event.'
      });
    }
  }),
  decode: z.object({
    fields: z.record(z.string(), decodeFieldSchema).optional()
  }).optional(),
  filters: z.array(
    z.object({
      field: z.string().min(1),
      op: filterOperatorSchema,
      value: z.string().optional(),
      values: z.array(z.string()).optional()
    }).superRefine((value, ctx) => {
      const requiresSingleValue = ['eq', 'neq', 'lt', 'lte', 'gt', 'gte'];
      const requiresMultipleValues = ['in', 'notIn'];

      if (requiresSingleValue.includes(value.op) && value.value === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `Filter "${value.field}" with operator "${value.op}" must define "value".`
        });
      }

      if (requiresMultipleValues.includes(value.op) && !value.values?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `Filter "${value.field}" with operator "${value.op}" must define a non-empty "values" list.`
        });
      }
    })
  ).optional(),
  request: z.object({
    method: httpMethodSchema,
    url: z.string().min(1),
    headers: z.record(z.string(), z.string()).optional(),
    contentType: z.string().min(1).optional(),
    body: z.string().optional(),
    signing: z.object({
      enabled: z.boolean(),
      secretEnv: z.string().min(1),
      header: z.string().min(1).optional()
    }).optional()
  })
});
