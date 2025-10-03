import { Product } from '@/types/products'

export const createProduct = async (product: any) => {
    product.code = product.code.toUpperCase()
    console.log(product)
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/createProduct`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product),
        }
    )
    if (!res.ok) {
        const errorBody = await res.json().catch(() => null)
        console.log('es un error', errorBody)
        throw new Error(
            `Error ${res.status}: ${errorBody?.error || res.statusText}`
        )
    }
}

// ajusta según tu definición real
export type GetProduct = {
  id: string
  brand?: string
  code?: string
  color?: string
  sellPrice?: number
  costPrice?: number
  sizes?: { size: string; quantity: number }[]
  imageUrl?: string
  createdAt?: string | number | Date
}

export type ListMeta = {
  limit: number
  nextCursor: string | null
  hasNext: boolean
  total: number | null
}

export type ListProductsResponse = {
  meta: ListMeta
  products: GetProduct[]
}

type GetProductsParams = {
  cursor?: string | null
  limit?: number
  color?: string
  size?: string
  minPrice?: number | string
  maxPrice?: number | string
  orderBy?: string
  direction?: 'asc' | 'desc'
}

export const getProducts = async (params: GetProductsParams = {}): Promise<ListProductsResponse> => {
  const base = `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/listProducts`
  const qs = new URLSearchParams()

  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  if (params.cursor) qs.set('cursor', params.cursor)
  if (params.color) qs.set('color', String(params.color))
  if (params.size) qs.set('size', String(params.size))
  if (params.minPrice !== undefined) qs.set('minPrice', String(params.minPrice))
  if (params.maxPrice !== undefined) qs.set('maxPrice', String(params.maxPrice))
  if (params.orderBy) qs.set('orderBy', params.orderBy)
  if (params.direction) qs.set('direction', params.direction)

  const url = `${base}?${qs.toString()}`

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null)
    throw new Error(`Error ${res.status}: ${errorBody?.error || res.statusText}`)
  }

  const body = await res.json() as ListProductsResponse
  if (!Array.isArray(body.products)) {
    throw new Error('Respuesta inválida del servidor: falta products[]')
  }
  return body
}



// export const getProducts = async (): Promise<Product[]> => {
//     const res = await fetch(
//         `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/listProducts/`,
//         {
//             method: 'GET',
//             headers: { 'Content-Type': 'application/json' },
//         }
//     );
//     if (!res.ok) {
//         const errorBody = await res.json().catch(() => null)
//         throw new Error(
//         `Error ${res.status}: ${errorBody?.error || res.statusText}`
//         )
//     }

//     const products: Product[] = await res.json()
//     return products
// }

export const deleteProduct = async(id: string) => {
    await fetch(
        `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/deleteProduct`,
        {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        }
    )
}