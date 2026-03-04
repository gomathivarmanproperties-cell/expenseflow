import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from './app/api/auth/session/route';

type AppUserRole = 'admin' | 'finance' | 'manager' | 'employee';

// Define role-based page access rules
const roleAccess: Record<AppUserRole, string[]> = {
  employee: ['dashboard', 'expenses'],
  manager: ['dashboard', 'expenses', 'budgets', 'audit-trail'],
  finance: ['dashboard', 'expenses', 'vendors', 'budgets', 'audit-trail'],
  admin: ['dashboard', 'expenses', 'vendors', 'budgets', 'audit-trail']
};

// Public routes that don't require authentication
const publicRoutes = ['/', '/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Extract the path segments to determine the page
  const pathSegments = pathname.split('/').filter(Boolean);
  const currentPage = pathSegments[0] || '/';
  
  // Allow access to public routes
  if (publicRoutes.includes(pathname) || pathname === '/') {
    return NextResponse.next();
  }

  // Check if user is authenticated by verifying the session cookie
  const sessionCookie = request.cookies.get('session')?.value;
  
  if (!sessionCookie) {
    // No session cookie, redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Verify the JWT token and get user info
    const decodedToken = await verifySessionToken(sessionCookie);
    
    if (!decodedToken) {
      // Invalid token, redirect to login
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    const userRole = decodedToken.role as AppUserRole;

    // Check if the user has access to the requested page
    const allowedPages = roleAccess[userRole];
    
    if (!allowedPages.includes(currentPage)) {
      // User doesn't have access to this page
      // Redirect to their dashboard
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }

    // User is authenticated and has access, allow the request
    return NextResponse.next();

  } catch (error) {
    // Invalid session cookie or other error
    console.error('Middleware error:', error);
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
