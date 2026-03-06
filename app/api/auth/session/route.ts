import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';

// Simple JWT payload type
interface JWTPayload {
  uid: string;
  role: string;
  exp: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export async function POST(request: NextRequest) {
  try {
    const { uid, role } = await request.json();
    
    if (!uid || !role) {
      return NextResponse.json({ error: 'Missing uid or role' }, { status: 400 });
    }

    // Create JWT token with 5 days expiration
    const expiresIn = 60 * 60 * 24 * 5; // 5 days in seconds
    
    const token = await new SignJWT({ uid, role })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
      .sign(JWT_SECRET_KEY);

    // Set the JWT cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('session', token, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true });
    response.cookies.set('session', '', {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error clearing session:', error);
    return NextResponse.json({ error: 'Failed to clear session' }, { status: 500 });
  }
}

// Helper function to verify JWT token (used by middleware)
export async function verifySessionToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload as unknown as JWTPayload;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}
