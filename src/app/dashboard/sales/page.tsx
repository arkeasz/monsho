'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from '@/styles/sales.module.css'
import { listSales } from '@/api/sales'

// Si ya conoces los storeIds disponibles, lista aquí
const STORE_OPTIONS: { id: number, name: string }[] = [
  { id: 1219, name: '' },
  { id: 1274, name: '' },
  { id: 1374, name: '' },
  { id: 1375, name: '' },
]

export default function ListSalesPage() {
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filterCode, setFilterCode] = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  // removed min/max
  const [filterStoreId, setFilterStoreId] = useState<number | ''>('')
  const [filterStoreName, setFilterStoreName] = useState('')

  const [cursor, setCursor] = useState<string | null>(null)
  const [hasNext, setHasNext] = useState(false)

  async function fetchSales(reset = false) {
    try {
      setLoading(true)
      setError(null)

      const params: any = {
        limit: 20,
        productCode: filterCode.trim() || undefined,
        paymentMethod: filterMethod.trim() || undefined,
        // new store params:
        storeId: filterStoreId === '' ? undefined : filterStoreId,
        storeName: filterStoreName.trim() || undefined,
      }

      if (!reset && cursor) params.cursor = cursor

      const data = await listSales(params)
      setHasNext(data.meta.hasNext)
      setCursor(data.meta.nextCursor)

      setSales(prev => reset ? data.sales : [...prev, ...data.sales])
    } catch (err: any) {
      console.error('Error fetching sales:', err)
      setError(err.message || 'Error cargando ventas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSales(true) }, [])

  useEffect(() => {
    const t = setTimeout(() => { fetchSales(true) }, 400)
    return () => clearTimeout(t)
  }, [filterCode, filterMethod, filterStoreId, filterStoreName])

  const filtered = useMemo(() => sales, [sales])

  return (
    <section className={styles.sales}>

      <form onSubmit={e => e.preventDefault()} className={styles.filters_form}>
        <input
          placeholder="Código de producto"
          value={filterCode}
          onChange={e => setFilterCode(e.target.value)}
        />

        <input
          placeholder="Método de pago"
          value={filterMethod}
          onChange={e => setFilterMethod(e.target.value)}
        />

        <select
          value={filterStoreId}
          onChange={e => setFilterStoreId(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value=''>— Todas las tiendas —</option>
          {STORE_OPTIONS.map(s => (
            <option key={s.id} value={s.id}>{s.id} — {s.name}</option>
          ))}
        </select>
      </form>

      {loading && sales.length === 0 && <p>Cargando ventas…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !sales.length && !error && <p>No hay ventas registradas.</p>}

      {filtered.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Tienda</th>
              <th>Cant.</th>
              <th>Talla</th>
              <th>Precio</th>
              <th>Ganancia</th>
              <th>Método</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td>{s.productCode}</td>
                <td>{s.storeName ?? s.storeId ?? '-'}</td>
                <td>{s.quantity}</td>
                <td>{s.size}</td>
                <td>{(s.appliedSellPrice / 100).toFixed(2)}</td>
                <td>{(s.subGain / 100).toFixed(2)}</td>
                <td>{s.paymentMethod ?? '-'}</td>
                <td>{s.timestamp ? new Date(s.timestamp).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        {hasNext ? (
          <button onClick={() => fetchSales(false)} disabled={loading}>
            {loading ? 'Cargando…' : 'Cargar más'}
          </button>
        ) : (
          !loading && <p>No hay más ventas</p>
        )}
      </div>
    </section>
  )
}



// 'use client'

// import { useEffect, useMemo, useState } from 'react'
// import styles from '@/styles/sales.module.css'
// import { listSales } from '@/api/sales'

// export default function ListSalesPage() {
//   const FUNCTIONS_URL = process.env.NEXT_PUBLIC_FUNCTIONS_URL || ''
//   const [sales, setSales] = useState<any[]>([])
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState<string | null>(null)

//   const [filterCode, setFilterCode] = useState('')
//   const [filterMethod, setFilterMethod] = useState('')
//   const [filterMin, setFilterMin] = useState('')
//   const [filterMax, setFilterMax] = useState('')

//   const [cursor, setCursor] = useState<string | null>(null)
//   const [hasNext, setHasNext] = useState(false)

//   async function fetchSales(reset = false) {
//     try {
//       setLoading(true)
//       setError(null)

//       const params: any = {
//         limit: 20,
//         productCode: filterCode.trim() || undefined,
//         paymentMethod: filterMethod.trim() || undefined,
//         minRevenue: filterMin.trim() || undefined,
//         maxRevenue: filterMax.trim() || undefined,
//       }

//       if (!reset && cursor) params.cursor = cursor

//       const data = await listSales(params)
//       setHasNext(data.meta.hasNext)
//       setCursor(data.meta.nextCursor)

//       setSales(prev => reset ? data.sales : [...prev, ...data.sales])
//     } catch (err: any) {
//       console.error('Error fetching sales:', err)
//       setError(err.message || 'Error cargando ventas')
//     } finally {
//       setLoading(false)
//     }
//   }

//   // fetch inicial
//   useEffect(() => { fetchSales(true) }, [])

//   // refetch con filtros (debounce)
//   useEffect(() => {
//     const t = setTimeout(() => { fetchSales(true) }, 400)
//     return () => clearTimeout(t)
//   }, [filterCode, filterMethod, filterMin, filterMax])

//   const filtered = useMemo(() => sales, [sales])

//   return (
//     <section className={styles.sales}>

//       <form onSubmit={e => e.preventDefault()} className={styles.filters_form}>
//         <input
//           placeholder="Código de producto"
//           value={filterCode}
//           onChange={e => setFilterCode(e.target.value)}
//         />
//         <input
//           placeholder="Método de pago"
//           value={filterMethod}
//           onChange={e => setFilterMethod(e.target.value)}
//         />
//         <input
//           type="number"
//           placeholder="Mín ingresos"
//           value={filterMin}
//           onChange={e => setFilterMin(e.target.value)}
//         />
//         <input
//           type="number"
//           placeholder="Máx ingresos"
//           value={filterMax}
//           onChange={e => setFilterMax(e.target.value)}
//         />
//       </form>

//       {loading && sales.length === 0 && <p>Cargando ventas…</p>}
//       {error && <p style={{ color: 'red' }}>{error}</p>}
//       {!loading && !sales.length && !error && <p>No hay ventas registradas.</p>}

//       {filtered.length > 0 && (
//         <table className={styles.table}>
//           <thead>
//             <tr>
//               <th>Producto</th>
//               <th>Tienda</th>
//               <th>Cant.</th>
//               <th>Talla</th>
//               <th>Precio</th>
//               <th>Ganancia</th>
//               <th>Método</th>
//               <th>Fecha</th>
//             </tr>
//           </thead>
//           <tbody>
//             {filtered.map(s => (
//               <tr key={s.id}>
//                 <td>{s.productCode}</td>
//                 <td>{s.storeId ?? '-'}</td>
//                 <td>{s.quantity}</td>
//                 <td>{s.size}</td>
//                 <td>{(s.appliedSellPrice / 100).toFixed(2)}</td>
//                 <td>{(s.subGain / 100).toFixed(2)}</td>
//                 <td>{s.paymentMethod ?? '-'}</td>
//                 <td>{s.timestamp ? new Date(s.timestamp).toLocaleString() : '-'}</td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       )}

//       <div style={{ textAlign: 'center', marginTop: 20 }}>
//         {hasNext ? (
//           <button onClick={() => fetchSales(false)} disabled={loading}>
//             {loading ? 'Cargando…' : 'Cargar más'}
//           </button>
//         ) : (
//           !loading && <p>No hay más ventas</p>
//         )}
//       </div>
//     </section>
//   )
// }
