import { config } from 'dotenv';
process.env.NODE_ENV =
  process.env.NODE_ENV === undefined ? 'production' : process.env.NODE_ENV;
config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });

export const CREDENTIALS = process.env.CREDENTIALS === 'true';
export const {
  NODE_ENV,
  PORT,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  PAYER_SECRET_KEY,
  PROGRAM_ID,
  USDC_MINT,
} = process.env;
