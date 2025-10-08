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

export type ListSalesParams = {
  limit?: number;
  productCode?: string;
  storeId?: number | string;
  paymentMethod?: string;
  date?: string; // YYYY-MM-DD
  minRevenue?: string; // ej. "12.50"
  maxRevenue?: string;
  cursor?: string | null;
};

export type SaleItem = {
  id: string;
  productCode: string;
  storeId: number | null;
  quantity: number;
  size: string;
  costPrice: number | null;
  originalSellPrice: number | null;
  appliedSellPrice: number;
  subGain: number | null;
  paymentMethod: string | null;
  revenue: number;
  timestamp: string | null;
};

export type ListSalesResponse = {
  meta: { limit: number; nextCursor: string | null; hasNext: boolean; total: number | null };
  sales: SaleItem[];
};

function buildQs(params: ListSalesParams) {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.productCode) qs.set('productCode', String(params.productCode));
  if (params.storeId !== undefined) qs.set('storeId', String(params.storeId));
  if (params.paymentMethod) qs.set('paymentMethod', String(params.paymentMethod));
  if (params.date) qs.set('date', params.date);
  if (params.minRevenue) qs.set('minRevenue', params.minRevenue);
  if (params.maxRevenue) qs.set('maxRevenue', params.maxRevenue);
  if (params.cursor) qs.set('cursor', params.cursor);
  return qs.toString();
}

/**
 * Llama directamente a la Cloud Function listSales/listSales
 */
export async function listSales(params: ListSalesParams = {}): Promise<ListSalesResponse> {
  const base = process.env.NEXT_PUBLIC_FUNCTIONS_URL;
  if (!base) throw new Error('Falta NEXT_PUBLIC_FUNCTIONS_URL en environment');

  const endpoint = `${base.replace(/\/$/, '')}/listSales`;
  const qs = buildQs(params);
  const url = qs ? `${endpoint}?${qs}` : endpoint;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // si necesitas enviar token, añade Authorization aquí
      // Authorization: `Bearer ${token}`
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Error ${res.status}: ${body?.error ?? res.statusText}`);
  }

  return res.json();
}
