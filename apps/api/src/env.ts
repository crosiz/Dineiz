import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('8080'),

  DATABASE_URL: z.string(),
  DIRECT_URL: z.string(),

  REDIS_URL: z.string(),
  UPSTASH_REDIS_REST_URL: z.string(),
  UPSTASH_REDIS_REST_TOKEN: z.string(),

  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),
  CLOUDINARY_FOLDER: z.string().default('dineiz-dev'),

  RESEND_API_KEY: z.string(),
  EMAIL_FROM: z.string().default('Dineiz <notifications@dineiz.com>'),

  JWT_SECRET: z.string().min(32),
  MOBILE_JWT_SECRET: z.string().min(32),
  SUPER_ADMIN_JWT_SECRET: z.string().min(32),

  CORS_ORIGINS: z.string(),
});

// Safe validation logic so we do not log secrets
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment validation failed!');
  
  parsed.error.errors.forEach((err) => {
    // Only report the variable name (path), never the actual value.
    console.error(`- Missing or invalid environment variable: ${err.path.join('.')}`);
  });
  
  process.exit(1);
}

export const env = parsed.data;
