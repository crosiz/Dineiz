import twilio from 'twilio';
import { Resend } from 'resend';
import { env } from '../env';

export function getTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

export function getResend() {
  const key = env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

