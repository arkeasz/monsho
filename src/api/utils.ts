export async function apiRequest<T>(
  path: string,
  body: any
): Promise<T> {
  const url = `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/${path}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Error ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

export async function apiRequestBodyOptional<T>(
  path: string,
  body?: any
): Promise<T> {
  const url = `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/${path}`;
  const options: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const resp = await fetch(url, options);
  if (!resp.ok) throw new Error(`Error ${resp.status}: ${await resp.text()}`);
  return resp.json();
}