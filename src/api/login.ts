'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiRequest } from '@/api/utils';
import { SignJWT } from 'jose';

export async function loginAction(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  let datos;
  try {
    datos = await apiRequest<{ role: string; uid: string }>('login/login', {
      username,
      password,
    });
  } catch (err: any) {
    if (err.message.startsWith('Error 401')) {
      return { error: 'Usuario o contraseña incorrectos' };
    }
    throw err;
  }

  const { role, uid } = datos!;
  const token = await new SignJWT({ uid, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

  const isProd = process.env.NODE_ENV === 'production';


  (await cookies()).set({
    name: 'token',
    value: token,
    httpOnly: true,
    maxAge: 9 * 60 * 60,
    path: '/',
    sameSite: isProd ? 'none' : 'lax', 
    secure: isProd,
  });

  redirect(role === 'admin' ? '/dashboard' : '/inventory');
}