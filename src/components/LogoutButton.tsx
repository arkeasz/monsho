'use client'

import { apiRequestBodyOptional } from '@/api/utils'; // o el path correcto

export function LogoutButton() {
  const handleLogout = async () => {
    try {
      const res = await apiRequestBodyOptional<{ message: string }>('logout/logout');
      console.log(res.message); // opcional
      window.location.href = '/';
    } catch (error) {
      console.error('Error al cerrar sesión', error);
    }
  };

  return <button onClick={handleLogout}>CERRAR SESIÓN</button>;
}
