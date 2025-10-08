export interface RegisterSalePayload {
  productCode: string;
  storeId: number;
  quantity: number;
  size: string;
  paymentMethod: string;
}

export interface RegisterSaleResponse {
  message: string;
}
