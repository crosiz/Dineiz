import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@swiftserve/db";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";
import Redis from "ioredis";
import { smsQueue } from "../../jobs/sms.worker";
import { mobileAuthMiddleware, MobileJwtPayload } from "../../middleware/mobileAuth.middleware";

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
const OTP_RATE_LIMIT_PHONE = parseInt(process.env.OTP_RATE_LIMIT_PER_PHONE_PER_HOUR || '3', 10);
const OTP_RATE_LIMIT_IP = parseInt(process.env.OTP_RATE_LIMIT_PER_IP_PER_HOUR || '10', 10);

const JWT_SECRET = process.env.MOBILE_JWT_SECRET || 'super-secret-mobile-jwt-key';

export const mobileRoutes: FastifyPluginAsyncZod = async (fastify) => {

  // RATE LIMIT UTILS
  const checkRateLimit = async (key: string, limit: number, windowSeconds: number): Promise<boolean> => {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    return current <= limit;
  };

  const generateTokens = (user: any, purpose: 'LOGIN' | 'REGISTRATION' | 'RESET_PIN') => {
    const payload: MobileJwtPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      phone: user.phone,
      purpose: 'access',
    };
    const accessOptions = { expiresIn: process.env.MOBILE_ACCESS_TOKEN_EXPIRY || '7d' };
    const refreshOptions = { expiresIn: process.env.MOBILE_REFRESH_TOKEN_EXPIRY || '90d' };

    const accessToken = jwt.sign(payload, JWT_SECRET, accessOptions as any);
    const refreshToken = jwt.sign({ ...payload, purpose: 'refresh' }, JWT_SECRET, refreshOptions as any);
    return { accessToken, refreshToken };
  };

  fastify.post(
    "/api/mobile/auth/request-otp",
    {
      schema: {
        body: z.object({ phone: z.string(), purpose: z.enum(['REGISTRATION', 'LOGIN', 'RESET_PIN']).default('LOGIN'), deviceId: z.string().optional() }),
      },
    },
    async (request, reply) => {
      const { phone, purpose, deviceId } = request.body as any;
      const ip = request.ip;

      // Rate limiting
      const phoneOk = await checkRateLimit(`rate:otp:phone:${phone}`, OTP_RATE_LIMIT_PHONE, 3600);
      if (!phoneOk) return reply.status(429).send({ success: false, error: "Too many requests for this phone number. Try again later." });

      const ipOk = await checkRateLimit(`rate:otp:ip:${ip}`, OTP_RATE_LIMIT_IP, 3600);
      if (!ipOk) return reply.status(429).send({ success: false, error: "Too many requests from this IP. Try again later." });

      if (deviceId) {
        const deviceOk = await checkRateLimit(`rate:otp:device:${deviceId}`, 5, 3600);
        if (!deviceOk) return reply.status(429).send({ success: false, error: "Too many requests from this device. Try again later." });
      }

      // Generate real 6-digit random OTP if Twilio is configured, else fallback to 123456 in dev
      const isTwilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
      const otpCode = isTwilioConfigured || process.env.NODE_ENV === 'production'
        ? crypto.randomInt(100000, 999999).toString()
        : '123456';
      const sessionId = crypto.randomUUID();

      // Save to Redis (TTL 5 mins)
      await redis.setex(`otp:${sessionId}:${phone}`, 300, otpCode);

      // Audit log in DB
      await prisma.otpSession.create({
        data: {
          id: sessionId,
          phone,
          purpose,
          ipAddress: ip,
          deviceId,
        }
      });

      // Add to BullMQ
      await smsQueue.add('sendOtp', { phone, code: otpCode, type: 'sms' });

      return { success: true, sessionId };
    }
  );

  fastify.post(
    "/api/mobile/auth/verify-otp",
    {
      schema: {
        body: z.object({ phone: z.string(), code: z.string(), sessionId: z.string() }),
      },
    },
    async (request, reply) => {
      const { phone, code, sessionId } = request.body as any;
      const redisKey = `otp:${sessionId}:${phone}`;
      
      const storedOtp = await redis.get(redisKey);
      if (!storedOtp) {
        return reply.status(400).send({ success: false, error: "OTP expired or invalid session" });
      }

      const isValid = crypto.timingSafeEqual(Buffer.from(storedOtp), Buffer.from(code));
      if (!isValid) {
        return reply.status(400).send({ success: false, error: "Incorrect OTP" });
      }

      // Valid! Delete from redis & update DB
      await redis.del(redisKey);
      await prisma.otpSession.update({
        where: { id: sessionId },
        data: { verifiedAt: new Date() }
      });

      // Find or create User
      let user = await prisma.user.findUnique({ where: { phone } });
      let isNewUser = false;

      if (!user) {
        isNewUser = true;
        user = await prisma.user.create({
          data: { phone, name: "Owner", role: "TENANT_ADMIN" }
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() }
        });
      }

      const { accessToken, refreshToken } = generateTokens(user, 'LOGIN');
      
      // Store hashed access token signature in MobileSession for revocation support
      const signature = accessToken.split('.')[2];
      await prisma.mobileSession.create({
        data: {
          userId: user.id,
          token: signature,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      let branchId: string | undefined;
      let branding: any = undefined;

      if (user.tenantId) {
        const branch = await prisma.branch.findFirst({ where: { tenantId: user.tenantId } });
        if (branch) branchId = branch.id;

        const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
        if (tenant) {
          branding = {
            restaurantName: tenant.name,
            primaryColor: tenant.colorPrimary,
            logoUrl: tenant.logoUrl,
            phone: tenant.primaryPhone
          };
        }
      }

      const userPayload = { ...user, branchId };

      return {
        success: true,
        isNewUser,
        accessToken,
        refreshToken,
        user: userPayload,
        branding
      };
    }
  );

  fastify.post(
    "/api/mobile/auth/set-pin",
    {
      preHandler: mobileAuthMiddleware,
      schema: {
        body: z.object({ pin: z.string() }),
      },
    },
    async (request, reply) => {
      const { pin } = request.body as any;
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;

      // Note: Client should send `SHA256(pin + userId)`, but we bcrypt it here regardless
      const hashedPin = await bcrypt.hash(pin, 12);
      
      const updatedUser = await prisma.user.update({
        where: { id: mobileUserReq.userId },
        data: { posPin: hashedPin }
      });

      return { success: true, user: updatedUser };
    }
  );

  fastify.post(
    "/api/mobile/auth/login-with-pin",
    {
      schema: {
        body: z.object({ phone: z.string(), pinHash: z.string() }), // Client sends SHA256
      },
    },
    async (request, reply) => {
      const { phone, pinHash } = request.body as any;
      const attemptKey = `pin_attempts:${phone}`;

      const attempts = await redis.get(attemptKey);
      if (attempts && parseInt(attempts) >= OTP_MAX_ATTEMPTS) {
        return reply.status(429).send({ success: false, error: "Too many failed attempts. Try again in 30 minutes." });
      }

      const user = await prisma.user.findUnique({ where: { phone } });
      if (!user) return reply.status(401).send({ success: false, error: "User not found" });
      if (!user.posPin) return reply.status(401).send({ success: false, error: "PIN not set" });

      const isValid = await bcrypt.compare(pinHash, user.posPin);
      if (!isValid) {
        const newAttempts = await redis.incr(attemptKey);
        if (newAttempts === 1) await redis.expire(attemptKey, 1800); // 30 min lock
        return reply.status(401).send({ success: false, error: "Invalid PIN" });
      }

      // Success, clear attempts
      await redis.del(attemptKey);

      await prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() }
      });

      const { accessToken, refreshToken } = generateTokens(user, 'LOGIN');
      const signature = accessToken.split('.')[2];
      await prisma.mobileSession.create({
        data: {
          userId: user.id,
          token: signature,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      let branchId: string | undefined;
      let branding: any = undefined;
      if (user.tenantId) {
        const branch = await prisma.branch.findFirst({ where: { tenantId: user.tenantId } });
        if (branch) branchId = branch.id;
        
        const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
        if (tenant) {
          branding = {
            restaurantName: tenant.name,
            primaryColor: tenant.colorPrimary,
            logoUrl: tenant.logoUrl,
            phone: tenant.primaryPhone
          };
        }
      }
      const userPayload = { ...user, branchId };

      return { success: true, accessToken, refreshToken, user: userPayload, branding };
    }
  );

  fastify.post(
    "/api/mobile/auth/refresh-token",
    {
      schema: {
        body: z.object({ refreshToken: z.string() }),
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body as any;
      try {
        const decoded = jwt.verify(refreshToken, JWT_SECRET) as MobileJwtPayload;
        if (decoded.purpose !== 'refresh') {
          return reply.status(401).send({ success: false, error: "Invalid token type" });
        }

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) return reply.status(401).send({ success: false, error: "User not found" });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user, 'LOGIN');
        const signature = newAccessToken.split('.')[2];
        await prisma.mobileSession.create({
          data: {
            userId: user.id,
            token: signature,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        });

        return { success: true, accessToken: newAccessToken, refreshToken: newRefreshToken };
      } catch (err) {
        return reply.status(401).send({ success: false, error: "Invalid or expired refresh token" });
      }
    }
  );

  fastify.delete(
    "/api/mobile/auth/logout",
    {
      preHandler: mobileAuthMiddleware,
    },
    async (request, reply) => {
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;
      const authHeader = request.headers.authorization!;
      const token = authHeader.split(' ')[1];
      const signature = token.split('.')[2];

      // Remove from MobileSession
      await prisma.mobileSession.deleteMany({
        where: { token: signature }
      });

      // Clear device tokens (for FCM)
      await prisma.user.update({
        where: { id: mobileUserReq.userId },
        data: { deviceTokens: [] }
      });

      // Optional: add token to redis blocklist if you wanted strict immediate expiration
      const exp = jwt.decode(token) as any;
      if (exp && exp.exp) {
        const ttl = exp.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redis.setex(`blocklist:${signature}`, ttl, 'true');
        }
      }

      return { success: true };
    }
  );
};
