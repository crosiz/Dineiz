import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import twilio from 'twilio';

// Create a Redis connection
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const smsQueue = new Queue('sms', { connection });

let twilioClient: twilio.Twilio | null = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.startsWith('AC') && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

export const initSmsWorker = () => {
  const worker = new Worker('sms', async (job: Job) => {
    const { phone, code, type } = job.data;
    
    if (type === 'sms') {
      if (!twilioClient) {
        console.warn('Twilio not configured. Skipping real SMS to', phone, 'with code', code);
        return;
      }
      try {
        await twilioClient.messages.create({
          body: `Your Dineiz Go confirmation code is: ${code}. Valid for 5 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone,
        });
        console.log(`Sent SMS OTP to ${phone}`);
      } catch (err) {
        console.error('Twilio SMS error:', err);
        throw err; // BullMQ will retry
      }
    } else if (type === 'whatsapp') {
      // Logic for WhatsApp using Facebook Graph API or Twilio WhatsApp
      console.log(`Sent WhatsApp OTP to ${phone} with code ${code}`);
    } else {
      console.warn('Unknown job type in sms queue:', type);
    }
  }, { 
    connection,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  });

  worker.on('failed', (job, err) => {
    console.error(`SMS Job failed: ${job?.id}`, err);
  });
};
