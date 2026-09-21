import 'dotenv/config';

export const env = {
  PORT: Number(process.env.PORT) || 4010,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:3012',
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || 'http://localhost:4010',
};
