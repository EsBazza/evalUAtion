import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './auth.edge';

export default async function proxy(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  if (!session) {
    // Redirect to login if not authenticated and trying to access protected routes
    return NextResponse.redirect(new URL('/', request.url));
  }

  const role = (session.user as any)?.role;

  if (role === 'STUDENT' && (pathname.startsWith('/faculty') || pathname.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/evaluate', request.url));
  }

  if (role === 'FACULTY' && (pathname.startsWith('/evaluate') || pathname.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/faculty', request.url));
  }

  if (pathname.startsWith('/admin') && role !== 'ADMIN' && role !== 'SUB_ADMIN') {
    if (role === 'STUDENT') {
      return NextResponse.redirect(new URL('/evaluate', request.url));
    } else if (role === 'FACULTY') {
      return NextResponse.redirect(new URL('/faculty', request.url));
    } else {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/evaluate/:path*', '/faculty/:path*', '/admin/:path*'],
};
