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

export const getProducts = async (): Promise<Product[]> => {
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/listProducts/`,
        {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        }
    );
    if (!res.ok) {
        const errorBody = await res.json().catch(() => null)
        throw new Error(
        `Error ${res.status}: ${errorBody?.error || res.statusText}`
        )
    }

    const products: Product[] = await res.json()
    return products
}

// export async function getProducts({ limit = 50, pageToken }: { limit?: number; pageToken?: string } = {}) {
//   const base = (process.env.NEXT_PUBLIC_FUNCTIONS_URL || '').replace(/\/$/, '')
//   if (!base) throw new Error('NEXT_PUBLIC_FUNCTIONS_URL no definida')
//   const params = new URLSearchParams()
//   params.set('limit', String(limit))
//   if (pageToken) params.set('pageToken', pageToken)
//   const url = `${base}/listProducts?${params.toString()}`
//   const res = await fetch(url)
//   const text = await res.text().catch(() => '')
//   if (!res.ok) {
//     try {
//       const json = text ? JSON.parse(text) : null
//       throw new Error((json && json.error) ? json.error : `Error ${res.status}`)
//     } catch {
//     console.log(res.status, text)
//       throw new Error(text || `Error ${res.status}`)
//     }
//   }
//   return JSON.parse(text)
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