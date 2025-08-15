import { Store } from "@/types/store";

const BASE = process.env.NEXT_PUBLIC_FUNCTIONS_URL;

export const createStore = async (store: Store) => {
  const res = await fetch(`${BASE}/stores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(store),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(`Error ${res.status}: ${errorBody?.error || res.statusText}`);
  }

  // si quieres que devuelva el doc creado, descomenta:
  // return await res.json();
};

export const getStores = async (): Promise<Store[]> => {
  const res = await fetch(`${BASE}/stores`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(`Error ${res.status}: ${errorBody?.error || res.statusText}`);
  }

  const stores: Store[] = await res.json();
  return stores;
};

export const updateStore = async (id: string, updates: Partial<Store>) => {
  const res = await fetch(`${BASE}/stores/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...updates }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(`Error ${res.status}: ${errorBody?.error || res.statusText}`);
  }

  // opcional: devolver el documento actualizado
  // return await res.json();
};

export const deleteStore = async (id: string) => {
  const res = await fetch(`${BASE}/stores/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(`Error ${res.status}: ${errorBody?.error || res.statusText}`);
  }
};
