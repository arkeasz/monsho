export interface RegisterSalePayload {
  productCode: string;
  storeId: number;
  quantity: number;
  size: string;
}

export interface RegisterSaleResponse {
  message: string;
}
