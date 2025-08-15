import { OtherExpense } from "@/types/expenses";

const BASE_URL = process.env.NEXT_PUBLIC_FUNCTIONS_URL + '/expenses';

export const createOtherExpense = async (expense: {
  name: string;
  costDaily: number;
  dateISO: string;
}) => {
  const res = await fetch(`${BASE_URL}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expense),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(`Error ${res.status}: ${errorBody?.error || res.statusText}`);
  }
  const data = await res.json();
  return data.id as string;
};
export const getOtherExpenses = async (dateISO: string): Promise<OtherExpense[]> => {
  const res = await fetch(`${BASE_URL}/?dateISO=${encodeURIComponent(dateISO)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(`Error ${res.status}: ${errorBody?.error || res.statusText}`);
  }
  const expenses: OtherExpense[] = await res.json();
  return expenses;
};

export const updateOtherExpense = async (
  id: string,
  expense: { name?: string; costDaily?: number; dateISO: string }
) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expense),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(`Error ${res.status}: ${errorBody?.error || res.statusText}`);
  }
};

export const deleteOtherExpense = async (id: string, dateISO: string) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dateISO }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(`Error ${res.status}: ${errorBody?.error || res.statusText}`);
  }
};