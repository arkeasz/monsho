'use server'

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation';

export async function logoutAction() {
  (await cookies()).set({
    name: 'token',
    value: '',
    httpOnly: true,
    maxAge: 0,       
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  revalidatePath("/", "layout"); 
  redirect('/')   
}