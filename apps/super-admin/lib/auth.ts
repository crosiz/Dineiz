import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export const SUPERADMIN_COOKIE_NAME = 'dineiz_superadmin_session';
const JWT_SECRET = new TextEncoder().encode(
  process.env.SUPERADMIN_JWT_SECRET || 'dineiz-super-admin-jwt-secret-key-2026-isolated'
);

export interface SuperAdminJwtPayload {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'SUPPORT' | 'SALES';
}

export async function signSuperAdminToken(payload: SuperAdminJwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(JWT_SECRET);
}

export async function verifySuperAdminToken(token: string): Promise<SuperAdminJwtPayload | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as unknown as SuperAdminJwtPayload;
  } catch (error) {
    return null;
  }
}

export async function getCurrentSuperAdmin(): Promise<SuperAdminJwtPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SUPERADMIN_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySuperAdminToken(token);
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
