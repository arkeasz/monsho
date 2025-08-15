import type { Account } from '@/types/user' 

export const getAccounts = async (): Promise<Account[]> => {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/getAllAccounts/getAllAccounts`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }
  )
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null)
    throw new Error(
      `Error ${res.status}: ${errorBody?.error || res.statusText}`
    )
  }
  return res.json()
}

export const updateAccount = async (
  uid: string,
  username?: string,
  password?: string,
  role?: 'worker' | 'admin'
): Promise<void> => {

  const payload: any = { uid };
  if (username) payload.username = username
  if (password) payload.password = password
  if (role) payload.role = role

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/updateUser/updateUser`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, username, password, role }),
    }
  )

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null)
    throw new Error(
      `Error ${res.status}: ${errorBody?.error || res.statusText}`
    )
  }
}


export const deleteAccount = async (uid: string): Promise<void> => {
    const res = await fetch(
    `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/deleteUser/deleteUser`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    }
  )
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null)
    throw new Error(
      `Error ${res.status}: ${errorBody?.error || res.statusText}`
    )
  }
}