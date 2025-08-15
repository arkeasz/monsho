export interface SizeInfo {
  size: string
  quantity: number
}

export interface Product {
  id: string
  brand: string
  code: string
  color: string
  costPrice: number
  description: string
  sellPrice: number
  sizes: SizeInfo[]
  createdAt: string
  updatedAt: string
  imageUrl: string
}

export interface NewProduct {
  brand: string
  code: string
  color: string
  costPrice: number
  description: string
  sellPrice: number
  sizes: Record<string, number>
  imageUrl: string
}
