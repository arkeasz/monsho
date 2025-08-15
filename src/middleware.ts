import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const { pathname } = req.nextUrl;

  if (['/'].includes(pathname)) {
    if (token) {
      try {
        const { payload } = await jwtVerify(token, secret);
        const role = (payload as any).role;
        const url = req.nextUrl.clone();
        url.pathname = role === 'admin' ? '/dashboard' : '/inventory';
        return NextResponse.redirect(url);
      } catch {
        return NextResponse.next();
      }
    }
    return NextResponse.next();
  }

  // if (pathname === '/signup') {
  //     if (!token) {
  //       // Si no hay token, vas al login
  //       const url = req.nextUrl.clone();
  //       url.pathname = '/';
  //       return NextResponse.redirect(url);
  //     }
  //     try {
  //       const { payload } = await jwtVerify(token, secret);
  //       const role = (payload as any).role;
  //       if (role !== 'admin') {
  //         // Si estás logeado pero no eres admin, te mando a inventory
  //         const url = req.nextUrl.clone();
  //         url.pathname = '/inventory';
  //         return NextResponse.redirect(url);
  //       }
  //       // Eres admin → permito /signup
  //       return NextResponse.next();
  //     } catch {
  //       // token inválido → al login
  //       const url = req.nextUrl.clone();
  //       url.pathname = '/';
  //       return NextResponse.redirect(url);
  //     }
  //   }

  if (!['/dashboard', '/inventory'].some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (!token) {
    const url = req.nextUrl.clone(); url.pathname = '/';
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    const role = (payload as any).role;
    return NextResponse.next();
  } catch {
    const url = req.nextUrl.clone(); url.pathname = '/';
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/inventory/:path*', '/', '/signup'],
};