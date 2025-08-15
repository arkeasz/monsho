import { Employee, EmployeeEvent } from "@/types/employees";

const BASE = (process.env.NEXT_PUBLIC_FUNCTIONS_URL || '').replace(/\/$/, '') + '/employees';

/** Employees CRUD */
export const getEmployees = async (): Promise<Employee[]> => {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
};

export const createEmployee = async (payload: Partial<Employee>) => {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || res.statusText);
  }
  return res.json();
};

export const updateEmployee = async (id: string, updates: Partial<Employee>) => {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || res.statusText);
  }
  return res.json();
};

export const deleteEmployee = async (id: string) => {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || res.statusText);
  }
  return res.json();
};

/** Events sub-API */
export const getEmployeeEvents = async (employeeId: string, start?: string, end?: string): Promise<EmployeeEvent[]> => {
  const qs = new URLSearchParams();
  if (start) qs.set('start', start);
  if (end) qs.set('end', end);
  const url = `${BASE}/${employeeId}/events${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
};

export const addEmployeeEvent = async (employeeId: string, event: Partial<EmployeeEvent>) => {
  const res = await fetch(`${BASE}/${employeeId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || res.statusText);
  }
  return res.json();
};

export const deleteEmployeeEvent = async (employeeId: string, eventId: string) => {
  const res = await fetch(`${BASE}/${employeeId}/events/${eventId}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || res.statusText);
  }
  return res.json();
};