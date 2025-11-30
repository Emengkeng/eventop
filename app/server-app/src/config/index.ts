import { config } from 'dotenv';
import { ensureEnv } from './validateEnv';

process.env.NODE_ENV =
  process.env.NODE_ENV === undefined ? 'production' : process.env.NODE_ENV;

// Load environment variables in order of priority:
// 1. .env.{NODE_ENV}.local (highest priority)
// 2. .env.{NODE_ENV}
// 3. .env.local
// 4. .env (lowest priority)
config({ path: `.env.${process.env.NODE_ENV}.local` });
config({ path: `.env.${process.env.NODE_ENV}` });
config({ path: '.env.local' });
config({ path: '.env' });

// Validate required environment variables
ensureEnv([
  'PORT',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_HOST',
  'DB_NAME',
  'PAYER_SECRET_KEY',
  'PROGRAM_ID',
  'USDC_MINT',
]);

export const CREDENTIALS = process.env.CREDENTIALS === 'true';

export const {
  NODE_ENV,
  PORT,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_HOST,
  PAYER_SECRET_KEY,
  PROGRAM_ID,
  USDC_MINT,
} = process.env;
