import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';

export default async function proxy(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  if (!session) {
    // Optionally redirect to login if not authenticated and trying to access protected routes
    return NextResponse.next();
  }

  const role = (session.user as any)?.role;

  if (role === 'STUDENT' && (pathname.startsWith('/faculty') || pathname.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/evaluate', request.url));
  }

  if (role === 'FACULTY' && (pathname.startsWith('/evaluate') || pathname.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/faculty', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/evaluate/:path*', '/faculty/:path*', '/admin/:path*'],
};
