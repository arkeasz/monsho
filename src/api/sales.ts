import { RegisterSalePayload, RegisterSaleResponse } from "@/types/sales";

export const registerSale = async (
  payload: RegisterSalePayload
): Promise<RegisterSaleResponse> => {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/registerSale/registerSale`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(
      `Error ${res.status}: ${errorBody?.error || res.statusText}`
    );
  }

  return res.json();
};
