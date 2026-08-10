import { NextResponse } from 'next/server';
import { prisma } from '@swiftserve/db';
import { comparePassword, signSuperAdminToken, SUPERADMIN_COOKIE_NAME } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!superAdmin || !superAdmin.isActive) {
      return NextResponse.json({ error: 'Invalid credentials or inactive account' }, { status: 401 });
    }

    const isMatch = await comparePassword(password, superAdmin.password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await prisma.superAdmin.update({
      where: { id: superAdmin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await signSuperAdminToken({
      id: superAdmin.id,
      email: superAdmin.email,
      name: superAdmin.name,
      role: superAdmin.role as 'OWNER' | 'SUPPORT' | 'SALES',
    });

    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';

    await logAuditAction({
      superAdminId: superAdmin.id,
      action: 'LOGIN',
      ipAddress,
      notes: `Super Admin ${superAdmin.email} logged in successfully`,
    });

    const response = NextResponse.json({
      success: true,
      superAdmin: {
        id: superAdmin.id,
        email: superAdmin.email,
        name: superAdmin.name,
        role: superAdmin.role,
      },
    });

    response.cookies.set(SUPERADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
