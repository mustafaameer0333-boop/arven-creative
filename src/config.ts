import 'dotenv/config';
import { z } from 'zod';

const envSchema=z.object({
  DATABASE_URL:z.string().min(1),
  PORT:z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV:z.enum(['development','test','production']).default('development'),
  APP_URL:z.string().url().default('http://localhost:3000'),
  JWT_SECRET:z.string().min(32),
  ADMIN_EMAIL:z.string().email(),
  ADMIN_PASSWORD:z.string().min(12),
  TELEGRAM_BOT_TOKEN:z.string().optional(),
  TELEGRAM_CHAT_ID:z.string().optional(),
  BINANCE_PAY_API_KEY:z.string().optional(),
  BINANCE_PAY_SECRET_KEY:z.string().optional(),
  BINANCE_PAY_CERTIFICATE_SN:z.string().optional(),
  BINANCE_PAY_BASE_URL:z.string().url().default('https://bpay.binanceapi.com'),
  TRONGRID_BASE_URL:z.string().url().default('https://api.trongrid.io'),
  TRONGRID_API_KEY:z.string().optional(),
  TRON_RECEIVING_ADDRESS:z.string().optional(),
  USDT_TRC20_CONTRACT:z.string().default('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'),
  TRC20_MIN_CONFIRMATIONS:z.coerce.number().int().min(0).default(1),
  PAYMENT_AUTO_VERIFY:z.enum(['true','false']).default('false'),
  RESEND_API_KEY:z.string().optional(),
  DELIVERY_FROM_EMAIL:z.string().email().optional(),
  DELIVERY_ENCRYPTION_KEY:z.string().regex(/^[0-9a-fA-F]{64}$/).optional()
}).superRefine((v,ctx)=>{
  if(v.NODE_ENV==='production'){
    if(v.JWT_SECRET.startsWith('CHANGE_ME')||v.JWT_SECRET.startsWith('GENERATE_')) ctx.addIssue({code:'custom',path:['JWT_SECRET'],message:'JWT_SECRET must be replaced in production'});
    if(v.ADMIN_PASSWORD.startsWith('CHANGE_ME')) ctx.addIssue({code:'custom',path:['ADMIN_PASSWORD'],message:'ADMIN_PASSWORD must be replaced in production'});
  }
  const binance=[v.BINANCE_PAY_API_KEY,v.BINANCE_PAY_SECRET_KEY,v.BINANCE_PAY_CERTIFICATE_SN].filter(Boolean).length;
  if(binance!==0&&binance!==3) ctx.addIssue({code:'custom',path:['BINANCE_PAY_API_KEY'],message:'Set all Binance Pay credentials or leave all three empty'});
  if(v.RESEND_API_KEY && !v.DELIVERY_FROM_EMAIL) ctx.addIssue({code:'custom',path:['DELIVERY_FROM_EMAIL'],message:'DELIVERY_FROM_EMAIL is required when RESEND_API_KEY is set'});
});

export const env=envSchema.parse(process.env);
