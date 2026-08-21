import { upstash, redis } from './lib/redis';

async function testRedis() {
  console.log('Testing Upstash Redis REST...');
  try {
    const res = await upstash.set('test_ping', 'ok');
    console.log('Upstash REST SUCCESS:', res);
  } catch (e: any) {
    console.error('Upstash REST ERROR:', e.message);
  }

  console.log('Testing ioredis connection...');
  try {
    const ping = await redis.ping();
    console.log('ioredis PING SUCCESS:', ping);
  } catch (e: any) {
    console.error('ioredis PING ERROR:', e.message);
  } finally {
    redis.disconnect();
  }
}

testRedis();
