import { useInfiniteQuery } from '@tanstack/react-query'
import qs from 'qs'
// import { Product } from '@/types/products'

const fetchPage = async ({ pageParam = null, queryKey }: any) => {
  const [, filters] = queryKey
  const params = { ...filters, limit: 20 }
  if (pageParam) params.cursor = pageParam

  const query = qs.stringify(params)
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/listProducts?${query}`
  )

  console.log(res)

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null)
    throw new Error(
      `Error ${res.status}: ${errorBody?.error || res.statusText}`
    )
  }

  return res.json()
}

export function useProductsRQ(filters: Record<string, any> = {}) {
  return useInfiniteQuery({
    queryKey: ['products', filters],
    queryFn: fetchPage,
    getNextPageParam: (lastPage: any) => lastPage.meta?.nextCursor || undefined,
    initialPageParam: null,
    staleTime: 30_000, // cache 30s antes de revalidar
    // cacheTime: 5 * 60_000, // mantiene cache 5 min
    // keepPreviousData: true,
  })
}
