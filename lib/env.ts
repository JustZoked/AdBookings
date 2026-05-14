import { z } from 'zod'

const envSchema = z.object({
  // App
  DOMAIN: z.string().default('localhost:3000'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  CONTACT_EMAIL: z.string().email().default('m.molina@adsemble.do'),
  ADMIN_NOTIFICATION_EMAIL: z.string().email().default('m.molina@adsemble.do'),
  TZ: z.string().default('America/Santo_Domingo'),

  // DB
  DATABASE_URL: z.string().min(1),

  // Magic links
  BOOKING_ACTION_SECRET: z.string().min(32, 'Generate with: openssl rand -base64 48'),
  ACTION_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  // Email
  MAIL_DRIVER: z.enum(['graph', 'smtp']).default('graph'),

  // Microsoft Graph (required when MAIL_DRIVER=graph or CALENDAR_ENABLED=true)
  MS_TENANT_ID: z.string().optional(),
  MS_CLIENT_ID: z.string().optional(),
  MS_CLIENT_SECRET: z.string().optional(),
  MS_SENDER_EMAIL: z.string().email().optional(),

  // Calendar
  CALENDAR_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  // SMTP fallback
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Pricing
  NIGHT_SURCHARGE_START_HOUR: z.coerce.number().int().min(0).max(23).default(18),
  NIGHT_SURCHARGE_PERCENT: z.coerce.number().min(0).default(30),
  WEEKEND_SURCHARGE_PERCENT: z.coerce.number().min(0).default(30),
  BOOKING_BUFFER_MINUTES: z.coerce.number().int().min(0).default(15),

  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

function parseEnv() {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('Invalid environment variables:')
    for (const [key, issues] of Object.entries(result.error.flatten().fieldErrors)) {
      console.error(`  ${key}: ${(issues as string[]).join(', ')}`)
    }
    throw new Error('Invalid environment configuration. Check .env file.')
  }
  return result.data
}

// Parse once and export — throws at startup if invalid
export const env = parseEnv()
export type Env = typeof env
