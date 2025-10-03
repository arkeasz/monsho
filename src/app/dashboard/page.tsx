'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import styles from '@/styles/catalog.module.css'
import { createProduct } from '@/api/products'
import type { Product } from '@/types/products'
import Image from 'next/image'
import ImagesUpload from '@/components/ImagesUpload'
import SellView from '@/components/SellView'
import { useProductsRQ } from '@/hooks/useProductsRQ'
import { useQueryClient } from '@tanstack/react-query'

export default function Home() {
  const queryClient = useQueryClient()
  const FUNCTIONS_URL = process.env.NEXT_PUBLIC_FUNCTIONS_URL || ''
  const [filterSearch, setFilterSearch] = useState('')
  const [filterColor, setFilterColor] = useState('')
  const [filterSize, setFilterSize] = useState('')
  const [filterMinPrice, setFilterMinPrice] = useState('')
  const [filterMaxPrice, setFilterMaxPrice] = useState('')
  const [filterInStockOnly, setFilterInStockOnly] = useState(false)

  const [filtersDebounced, setFiltersDebounced] = useState({
    color: '',
    size: '',
    minPrice: '',
    maxPrice: ''
  })
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltersDebounced({
        color: filterColor.trim(),
        size: filterSize.trim(),
        minPrice: filterMinPrice.trim(),
        maxPrice: filterMaxPrice.trim()
      })
    }, 400)
    return () => clearTimeout(t)
  }, [filterColor, filterSize, filterMinPrice, filterMaxPrice])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: queryLoading, error: queryError } =
    useProductsRQ({
      color: filtersDebounced.color || undefined,
      size: filtersDebounced.size || undefined,
      minPrice: filtersDebounced.minPrice || undefined,
      maxPrice: filtersDebounced.maxPrice || undefined,
    })

  const productsFromServer: Product[] = useMemo(() => {
    if (!data?.pages) return []

    const all = data.pages.flatMap((p: any) => p.products || [])
    const seen = new Set<string>()
    const uniq: Product[] = []
    for (const p of all) {
      if (!p || !p.id) continue
      if (seen.has(p.id)) continue
      seen.add(p.id)
      uniq.push(p)
    }
    return uniq
  }, [data])


  const [removedIds, setRemovedIds] = useState<Record<string, boolean>>({})
  const visibleProducts = useMemo(() => productsFromServer.filter(p => !removedIds[p.id]), [productsFromServer, removedIds])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [imageKey, setImageKey] = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null)

  // campos edición
  const [editBrand, setEditBrand] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editCostPrice, setEditCostPrice] = useState(0)
  const [editDescription, setEditDescription] = useState('descripcion')
  const [editSellPrice, setEditSellPrice] = useState(0)
  const [editSizes, setEditSizes] = useState<{ size: string; quantity: number }[]>([])
  const [editImageKey, setEditImageKey] = useState<string | null>(null)

  function openEditModal(p: Product) {
    setEditingProduct(p)
    setEditBrand(p.brand ?? '')
    setEditCode(p.code ?? '')
    setEditColor(p.color ?? '')
    setEditCostPrice(Number(p.costPrice) / 100)
    setEditDescription(p.description ?? '')
    setEditSellPrice(Number(p.sellPrice) / 100)
    console.log(p)
    console.log(editSellPrice)
    setEditSizes(p.sizes ? p.sizes.map(s => ({ size: s.size, quantity: Number(s.quantity) })) : [])
    setEditImageKey(p.imageUrl ?? null)
  }
  function closeEditModal() {
    setEditingProduct(null)
    setEditLoading(false)
  }

  function buildUpdatePayload(original: Product, edited: {
    brand: string;
    code: string;
    color: string;
    costPrice: number;
    description: string;
    sellPrice: number;
    sizes: { size: string; quantity: number }[];
    imageKey: string | null;
  }) {
    const payload: any = { id: original.id }
    if ((edited.brand ?? '').trim() !== (original.brand ?? '').trim()) payload.brand = edited.brand.trim()
    if ((edited.code ?? '').trim() !== (original.code ?? '').trim()) payload.code = edited.code.trim()
    if ((edited.color ?? '').trim() !== (original.color ?? '').trim()) payload.color = edited.color.trim()
    const cost = Number(edited.costPrice)
    if (!Number.isNaN(cost) && cost !== (original.costPrice ?? 0)) payload.costPrice = cost
    if ((edited.description ?? '').trim() !== (original.description ?? '').trim()) payload.description = edited.description.trim()
    const sell = Number(edited.sellPrice)
    if (!Number.isNaN(sell) && sell !== (original.sellPrice ?? 0)) payload.sellPrice = sell
    const origSizes = JSON.stringify((original.sizes || []).map(s => ({ size: s.size, quantity: Number(s.quantity) })))
    const newSizes = JSON.stringify(edited.sizes || [])
    if (origSizes !== newSizes) payload.sizes = edited.sizes
    if ((edited.imageKey ?? null) !== (original.imageUrl ?? null)) payload.imageUrl = edited.imageKey ?? null
    return payload
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingProduct) return
    try {
      setEditLoading(true)
      const payload = buildUpdatePayload(editingProduct, {
        brand: editBrand,
        code: editCode,
        color: editColor,
        costPrice: editCostPrice,
        description: editDescription,
        sellPrice: editSellPrice,
        sizes: editSizes,
        imageKey: editImageKey,
      })
      if (Object.keys(payload).length <= 1) {
        closeEditModal()
        return
      }
      const res = await fetch(`${FUNCTIONS_URL}/updateProduct`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `Error ${res.status}`)
      }

      queryClient.invalidateQueries({ queryKey: ['products'] })
      closeEditModal()
    } catch (err: any) {
      console.error('update error', err)
      alert('Error actualizando: ' + (err?.message ?? 'desconocido'))
    } finally {
      setEditLoading(false)
    }
  }

  // borrado: borrado optimista simple (ocultamos mientras se hace la petición)
  async function handleDelete(productId: string) {
    const ok = confirm('¿Seguro que quieres borrar este producto? Esta acción no se puede deshacer.')
    if (!ok) return

    const prod = productsFromServer.find(p => p.id === productId)
    if (!prod) return

    try {
      setDeleteLoadingId(productId)
      setRemovedIds(prev => ({ ...prev, [productId]: true }))

      const res = await fetch(`${FUNCTIONS_URL}/deleteProduct`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: productId }),
      })

      if (prod.imageUrl) {
        await fetch('/api/images', {
          method: 'DELETE',
          body: JSON.stringify({ key: prod.imageUrl }),
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `Error ${res.status}`)
      }

      // refrescar datos
      queryClient.invalidateQueries({ queryKey: ['products'] })
    } catch (err: any) {
      // en caso de error restauramos
      setRemovedIds(prev => {
        const copy = { ...prev }
        delete copy[productId]
        return copy
      })
      console.error('delete error', err)
      alert('Error borrando: ' + (err?.message ?? 'desconocido'))
    } finally {
      setDeleteLoadingId(null)
    }
  }

  const [brand, setBrand] = useState('')
  const [code, setCode] = useState('')
  const [color, setColor] = useState('')
  const [costPrice, setCostPrice] = useState<any>('')
  const [description, setDescription] = useState('descripcion')
  const [sellPrice, setSellPrice] = useState<any>('')
  const [openViewSale, setOpenViewSale] = useState(false)
  const [sizes, setSizes] = useState<{ size: string; quantity: string }[]>([])

  const preventPasteNegative = (e: any) => {
    const text = (e.clipboardData || (window as any).clipboardData).getData('text')
    const pasted = parseFloat(text.replace(',', '.').trim())
    if (!Number.isNaN(pasted) && pasted < 0) e.preventDefault()
  }

  const addSizeField = () => setSizes(prev => [...prev, { size: '', quantity: '' }])
  const updateSize = (index: number, key: 'size' | 'quantity', value: string) => {
    setSizes(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [key]: value }
      return copy
    })
  }
  const removeSize = (index: number) => setSizes(prev => prev.filter((_, i) => i !== index))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)

      if (!code.trim()) throw new Error('El código es obligatorio.')
      if (!color.trim()) throw new Error('El color es obligatorio.')
      if (!Array.isArray(sizes) || sizes.length === 0) throw new Error('Debes agregar al menos una talla.')

      const payload = {
        brand: brand.trim(),
        code: code.trim(),
        color: color.trim(),
        costPrice: Number(costPrice),
        description: description.trim(),
        sellPrice: Number(sellPrice),
        sizes: sizes.map(s => ({ size: s.size.trim(), quantity: Number(s.quantity) })),
        imageUrl: imageKey ?? null,
      }

      await createProduct(payload)

      queryClient.invalidateQueries({ queryKey: ['products'] })

      setShowModal(false)
      setBrand(''); setCode(''); setColor(''); setCostPrice(''); setDescription(''); setSellPrice(''); setSizes([]); setImageKey(null);
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const API_KEY = process.env.NEXT_PUBLIC_IMAGES_API_KEY ?? ''

  async function fetchSignedUrlForKey(key: string) {
    const headers: Record<string, string> = {}
    if (API_KEY) headers['x-api-key'] = API_KEY
    const res = await fetch(`/api/images?key=${encodeURIComponent(key)}`, { headers })
    if (!res.ok) {
      const t = await res.text().catch(() => res.statusText)
      throw new Error(t || 'failed to get signed url')
    }
    const data = await res.json()
    return data.signedUrl as string
  }

  useEffect(() => {
    if (visibleProducts.length === 0) return
    let mounted = true
    const map: Record<string, string> = {}

    ;(async () => {
      await Promise.all(visibleProducts.map(async (p) => {
        try {
          if (!p.imageUrl) return
          if (signedUrls[p.id]) {
            map[p.id] = signedUrls[p.id]
            return
          }
          const signed = await fetchSignedUrlForKey(p.imageUrl)
          if (!mounted) return
          map[p.id] = signed
        } catch (e) {
          console.warn('no signed url for', p.id, e)
        }
      }))

      if (!mounted) return
      setSignedUrls(prev => ({ ...prev, ...map }))
    })()

    return () => { mounted = false }
  }, [visibleProducts])

  const filteredProducts = useMemo(() => {
    const s = filterSearch.trim().toLowerCase()
    const min = (() => {
      const t = (filterMinPrice ?? '').toString().trim()
      if (t === '') return null
      const n = Number(t.replace(',', '.'))
      return Number.isFinite(n) ? n : null
    })()
    const max = (() => {
      const t = (filterMaxPrice ?? '').toString().trim()
      if (t === '') return null
      const n = Number(t.replace(',', '.'))
      return Number.isFinite(n) ? n : null
    })()

    return visibleProducts.filter(p => {
      if (s) {
        const code = (p.code ?? '').toString().toLowerCase()
        const brand = (p.brand ?? '').toString().toLowerCase()
        const desc = (p.description ?? '').toString().toLowerCase()
        if (!code.includes(s) && !brand.includes(s) && !desc.includes(s)) return false
      }
      if (filterColor.trim()) {
        const color = (p.color ?? '').toString().toLowerCase()
        if (!color.includes(filterColor.trim().toLowerCase())) return false
      }
      const price = Number(p.sellPrice ?? p.costPrice ?? 0) / 100
      if (min !== null && price < min) return false
      if (max !== null && price > max) return false
      if (filterSize.trim()) {
        const sizesLower = (p.sizes || []).map(item => (item.size ?? '').toString().toLowerCase())
        if (!sizesLower.some(sv => sv.includes(filterSize.trim().toLowerCase()))) return false
      }
      if (filterInStockOnly) {
        const totalQty = (p.sizes || []).reduce((acc, s) => acc + Number(s.quantity || 0), 0)
        if (totalQty <= 0) return false
      }
      return true
    })
  }, [visibleProducts, filterSearch, filterColor, filterSize, filterMinPrice, filterMaxPrice, filterInStockOnly])

  return (
    <>
      <section className={styles.config}>
        <form onSubmit={(e) => e.preventDefault()} className={styles.filters_form}>
          <input
            type="search"
            placeholder="Código (ej. P1234)"
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
          />
          <input
            type="text"
            placeholder="Color"
            value={filterColor}
            onChange={e => setFilterColor(e.target.value)}
          />
          <input
            type="text"
            placeholder="Talla (ej. 25)"
            value={filterSize}
            onChange={e => setFilterSize(e.target.value)}
          />
        </form>
        <button className={styles.config_add_button} onClick={() => setShowModal(true)}>Añadir Producto</button>
      </section>

      <section className={styles.catalog}>
        {queryLoading && !filteredProducts.length && <p>Cargando productos…</p>}
        {queryError && <p>Error cargando productos.</p>}

        {filteredProducts.map((product: any) => (
          <li key={product.id} className={styles.product}>
            <h2 className={styles.product_title}>{product.code}</h2>
            <div className={styles.product_image}>
              {signedUrls[product.id] ? (
                <img
                  src={signedUrls[product.id]}
                  alt={product.code}
                  width={80}
                  height={100}
                  style={{ objectFit: 'cover', width: 80, height: 100 }}
                />
              ) : (
                <Image src="/preview.png" alt="preview" width={80} height={100} />
              )}
            </div>
            <div className={styles.product_details}>
              <div>
                <h3>Color</h3>
                <p>{product.color}</p>
              </div>
              <div>
                <h3>Tallas</h3>
                {product.sizes.length > 0 ? (
                  <ul className={styles.product_sizes}>
                    {product.sizes.map((s: any) => (
                      <li key={s.size}>{s.size}</li>
                    ))}
                  </ul>
                ) : (<p>No hay tallas registradas.</p>)}
              </div>
              <div>
                <h3>Cantidad</h3>
                <p>{product.sizes.reduce((sum: any, s: any) => sum + Number(s.quantity), 0)}</p>
              </div>
              <div className={styles.product_options}>
                <button className={styles.update_button} onClick={() => openEditModal(product)} disabled={!!editLoading}>
                  {editingProduct?.id === product.id && editLoading ? 'Guardando…' : 'Editar'}
                </button>
                <button className={styles.delete_button} onClick={() => handleDelete(product.id)} disabled={deleteLoadingId === product.id}>
                  {deleteLoadingId === product.id ? 'Borrando…' : 'Borrar'}
                </button>
              </div>
            </div>
          </li>
        ))}
      </section>

      <div style={{ textAlign: 'center', margin: 20 }}>
        {hasNextPage ? (
          <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
          </button>
        ) : (
          <p>{queryLoading ? '' : 'No hay más productos'}</p>
        )}
      </div>

      {showModal && (
        <div className={styles.modal_overlay}>
          <div className={styles.modal}>
            <div className={styles.modal_top}>
              <h2 className={styles.modal_title}>Nuevo Producto</h2>
              <button className={styles.close_button} onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className={styles.modal_content}>
              <ImagesUpload onUploaded={setImageKey} />
              <form onSubmit={handleSubmit} className={styles.modal_form}>
                {/* ... tus inputs ... */}
                <fieldset className={styles.modal_form_metadata}>
                  <legend>Detalles</legend>
                  <div className={styles.input_wrapped}>
                    <input placeholder="Código" value={code} onChange={e => setCode(e.target.value)} required />
                  </div>
                  <div className={styles.input_wrapped}>
                    <input placeholder="Color" value={color} onChange={e => setColor(e.target.value)} required />
                  </div>
                  <div className={styles.input_wrapped}>
                    <input placeholder="Precio de costo" type="number" min="0" step="0.01" onPaste={preventPasteNegative} value={costPrice} onChange={e => setCostPrice(Number(e.target.value))} required />
                  </div>
                  <div className={styles.input_wrapped}>
                    <input placeholder="Precio de venta" type="number" min="0" value={sellPrice} step="0.01" onChange={e => setSellPrice(Number(e.target.value))} required onPaste={preventPasteNegative} />
                  </div>
                  <div className={styles.input_wrapped}>
                    <input placeholder="Proveedor" value={brand} onChange={e => setBrand(e.target.value)} required />
                  </div>
                </fieldset>
                <fieldset className={styles.modal_form_sizes}>
                  <legend>Añadir Talla
                    <button className={styles.modal_form_add_size} type="button" onClick={addSizeField}>+</button>
                  </legend>
                  <div className={styles.form_sizes_grid}>
                    {sizes.map((s, i) => (
                      <div key={i} className={styles.sizeRow}>
                        <div className={styles.input_wrapped}>
                          <input placeholder="Talla" value={s.size} onChange={e => updateSize(i, 'size', e.target.value)} required />
                        </div>
                        <div className={styles.input_wrapped}>
                          <input placeholder="Cantidad" type="number" value={s.quantity} onChange={e => updateSize(i, 'quantity', e.target.value)} required />
                        </div>
                        <button type="button" onClick={() => removeSize(i)}>❌</button>
                      </div>
                    ))}
                  </div>
                </fieldset>
                <button className={styles.modal_save_button} type="submit" disabled={loading}>
                  { loading ? 'Guardando' : 'Guardar Producto' }
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className={styles.modal_edit_overlay}>
          <div className={styles.modal_edit}>
            <h3>Editar producto — {editingProduct.code}</h3>
            <form onSubmit={handleUpdateSubmit} className={styles.modal_edit_form}>
              <fieldset className={styles.modal_edit_details}>
                <legend>Detalles</legend>
                <label>Código<input value={editCode} onChange={e => setEditCode(e.target.value)} placeholder="Código" /></label>
                <label>Color<input value={editColor} onChange={e => setEditColor(e.target.value)} placeholder="Color" /></label>
                <label>Precio de costo<input step="0.01" value={Number(editCostPrice)} onChange={e => setEditCostPrice(Number(e.target.value))} type="number" /></label>
                <label>Precio de Venta<input step="0.01" value={Number(editSellPrice)} onChange={e => setEditSellPrice(Number(e.target.value))} type="number" /></label>
                <label>Proveedor<input value={editBrand} onChange={e => setEditBrand(e.target.value)} placeholder="Proveedor" /></label>
              </fieldset>
              <fieldset className={styles.modal_edit_sizes }>
                <legend><span>Tallas</span> <button type="button" onClick={() => setEditSizes(prev => [...prev, { size: '', quantity: 0 }])}>+</button></legend>
                {editSizes.map((s, i) => (
                  <div key={i} className={styles.sizeRow}>
                    <input value={s.size} onChange={e => {
                      const copy = [...editSizes]; copy[i] = { ...copy[i], size: e.target.value }; setEditSizes(copy);
                    }} placeholder="Talla" />
                    <input value={String(s.quantity)} type="number" onChange={e => {
                      const copy = [...editSizes]; copy[i] = { ...copy[i], quantity: Number(e.target.value) }; setEditSizes(copy);
                    }} placeholder="Cantidad" />
                    <button type="button" onClick={() => setEditSizes(prev => prev.filter((_, idx) => idx !== i))}>❌</button>
                  </div>
                ))}
              </fieldset>
              <fieldset className={styles.modal_edit_options}>
                <legend>Options</legend>
                <button type="submit" disabled={editLoading}>{editLoading ? 'Guardando' : 'Guardar Cambios'}</button>
                <button type="button" onClick={() => { closeEditModal(); setShowModal(false); }}>Cancelar</button>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      <button onClick={() => setOpenViewSale(!openViewSale)} className={styles.register_sell_button}>
        {openViewSale ? 'Cerrar' : 'Registrar Venta'}
      </button>

      {openViewSale && (<SellView />)}
    </>
  )
}