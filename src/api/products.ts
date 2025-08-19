import { Product } from '@/types/products'

export const createProduct = async (product: any) => {
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/createProduct/`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product),
        }
    )
    if (!res.ok) {
        const errorBody = await res.json().catch(() => null)
        throw new Error(
            `Error ${res.status}: ${errorBody?.error || res.statusText}`
        )
    }
}

export const getProducts = async (): Promise<Product[]> => {
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/listProducts/listProducts`,
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