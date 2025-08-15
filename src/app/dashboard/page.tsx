'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import styles from '@/styles/catalog.module.css'
import { getProducts, createProduct, deleteProduct } from '@/api/products'
import type { Product } from '@/types/products'
import Image from 'next/image'
import ImagesUpload from '@/components/ImagesUpload'

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterSize, setFilterSize] = useState(''); // texto de talla (p. ej. "M")
  const [filterMinPrice, setFilterMinPrice] = useState(''); // string para mantener control
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterInStockOnly, setFilterInStockOnly] = useState(false);

  const preventMinus = (e: React.KeyboardEvent) => {
    if (e.key === '-' || e.key === 'Subtract') e.preventDefault();
  };

  const preventPasteNegative = (e: any) => {
    const text = (e.clipboardData || (window as any).clipboardData).getData('text');
    const pasted = parseFloat(text.replace(',', '.').trim());
    if (!Number.isNaN(pasted) && pasted < 0) e.preventDefault();
  };

  const [editBrand, setEditBrand] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editCostPrice, setEditCostPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSellPrice, setEditSellPrice] = useState('');
  const [editSizes, setEditSizes] = useState<{ size: string; quantity: number }[]>([]);
  const [editImageKey, setEditImageKey] = useState<string | null>(null);

  const FUNCTIONS_URL = process.env.NEXT_PUBLIC_FUNCTIONS_URL || ''; // p.e. http://127.0.0.1:5001/monsho-93029/us-central1

  function openEditModal(p: Product) {
    setEditingProduct(p);
    setEditBrand(p.brand ?? '');
    setEditCode(p.code ?? '');
    setEditColor(p.color ?? '');
    setEditCostPrice(String(p.costPrice ?? ''));
    setEditDescription(p.description ?? '');
    setEditSellPrice(String(p.sellPrice ?? ''));
    setEditSizes(p.sizes ? p.sizes.map(s => ({ size: s.size, quantity: Number(s.quantity) })) : []);
    setEditImageKey(p.imageUrl ?? null);
    setShowEditModal(true); // si quieres usar el mismo modal que para crear; si no, abre otro
  }
  function closeEditModal() {
    setEditingProduct(null);
    setEditLoading(false);
    // limpiar campos si quieres
  }
  function buildUpdatePayload(original: Product, edited: {
    brand: string;
    code: string;
    color: string;
    costPrice: string;
    description: string;
    sellPrice: string;
    sizes: { size: string; quantity: number }[];
    imageKey: string | null;
  }) {
    const payload: any = { id: original.id };
    if ((edited.brand ?? '').trim() !== (original.brand ?? '').trim()) payload.brand = edited.brand.trim();
    if ((edited.code ?? '').trim() !== (original.code ?? '').trim()) payload.code = edited.code.trim();
    if ((edited.color ?? '').trim() !== (original.color ?? '').trim()) payload.color = edited.color.trim();
    const cost = Number(edited.costPrice);
    if (!Number.isNaN(cost) && cost !== (original.costPrice ?? 0)) payload.costPrice = cost;
    if ((edited.description ?? '').trim() !== (original.description ?? '').trim()) payload.description = edited.description.trim();
    const sell = Number(edited.sellPrice);
    if (!Number.isNaN(sell) && sell !== (original.sellPrice ?? 0)) payload.sellPrice = sell;
    // sizes: simple comparación por JSON (si cambian, reemplazamos)
    const origSizes = JSON.stringify((original.sizes || []).map(s => ({ size: s.size, quantity: Number(s.quantity) })));
    const newSizes = JSON.stringify(edited.sizes || []);
    if (origSizes !== newSizes) payload.sizes = edited.sizes;
    // imageKey: null => borrar, string => actualizar
    if ((edited.imageKey ?? null) !== (original.imageUrl ?? null)) payload.imageUrl = edited.imageKey ?? null;
    return payload;
  }
  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      setEditLoading(true);
      const payload = buildUpdatePayload(editingProduct, {
        brand: editBrand,
        code: editCode,
        color: editColor,
        costPrice: editCostPrice,
        description: editDescription,
        sellPrice: editSellPrice,
        sizes: editSizes,
        imageKey: editImageKey,
      });
      // si no hay campos para actualizar, cierra
      if (Object.keys(payload).length <= 1) { // solo id
        closeEditModal();
        return;
      }

      const res = await fetch(`${FUNCTIONS_URL}/updateProduct`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `Error ${res.status}`);
      }
      // refrescar lista
      setProducts(await getProducts());
      closeEditModal();
    } catch (err: any) {
      console.error('update error', err);
      alert('Error actualizando: ' + (err?.message ?? 'desconocido'));
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(productId: string) {
    const ok = confirm('¿Seguro que quieres borrar este producto? Esta acción no se puede deshacer.');
    if (!ok) return;
    try {
      setDeleteLoadingId(productId);
      const prod = products.find(p => p.id === productId);
      const res = await fetch(`${FUNCTIONS_URL}/deleteProduct`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: productId }),
      });

      if (prod?.imageUrl) {
        await fetch('/api/images', {
          method: 'DELETE',
          body: JSON.stringify({ key: prod.imageUrl }),
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!res.ok) {
        const txt = await res.text().catch(()=>'');
        throw new Error(txt || `Error ${res.status}`);
      }
      setProducts(await getProducts());
    } catch (err: any) {
      alert('Error borrando: ' + (err?.message ?? 'desconocido'));
    } finally {
      setDeleteLoadingId(null);
    }
  }
  const [brand, setBrand] = useState('')
  const [code, setCode] = useState('')
  const [color, setColor] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [description, setDescription] = useState('')
  const [sellPrice, setSellPrice] = useState('')

  // Para las tallas dinámicas
  const [sizes, setSizes] = useState<{ size: string; quantity: string }[]>([])

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const addSizeField = () => {
    setSizes(prev => [...prev, { size: '', quantity: '' }])
  }

  const updateSize = (index: number, key: 'size' | 'quantity', value: string) => {
    setSizes(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [key]: value }
      return copy
    })
  }

  const filteredProducts = useMemo(() => {
    const s = filterSearch.trim().toLowerCase();
    const c = filterColor.trim().toLowerCase();
    const sz = filterSize.trim().toLowerCase();

    // Normaliza min/max: si el input está vacío => null (sin filtro).
    const parseMaybeNumber = (raw: string): number | null => {
      const t = (raw ?? '').toString().trim();
      if (t === '') return null;
      // acepta "1,234" o "12,34" (reemplazando coma por punto)
      const normalized = t.replace(',', '.');
      const n = Number(normalized);
      return Number.isFinite(n) ? n : null;
    };

    const min = parseMaybeNumber(filterMinPrice);
    const max = parseMaybeNumber(filterMaxPrice);

    return products.filter(p => {
      // search por code/brand/description
      if (s) {
        const code = (p.code ?? '').toString().toLowerCase();
        const brand = (p.brand ?? '').toString().toLowerCase();
        const desc = (p.description ?? '').toString().toLowerCase();
        if (!code.includes(s) && !brand.includes(s) && !desc.includes(s)) return false;
      }

      // color
      if (c) {
        const color = (p.color ?? '').toString().toLowerCase();
        if (!color.includes(c)) return false;
      }

      // precio (sellPrice o costPrice)
      const price = Number(p.sellPrice ?? p.costPrice ?? 0);
      if (min !== null && price < min) return false;
      if (max !== null && price > max) return false;

      // talla: si hay filtro de talla, comprobar si la talla existe en sizes
      if (sz) {
        const sizesLower = (p.sizes || []).map(item => (item.size ?? '').toString().toLowerCase());
        if (!sizesLower.some(sv => sv.includes(sz))) return false;
      }

      // solo en stock: sumar cantidades
      if (filterInStockOnly) {
        const totalQty = (p.sizes || []).reduce((acc, s) => acc + Number(s.quantity || 0), 0);
        if (totalQty <= 0) return false;
      }

      return true;
    });
  }, [products, filterSearch, filterColor, filterSize, filterMinPrice, filterMaxPrice, filterInStockOnly]);


  const removeSize = (index: number) => {
    setSizes(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)
      
      const payload = {
        brand: '',
        code,
        color,
        costPrice: Number(costPrice),
        description,
        sellPrice: Number(sellPrice),
        sizes: sizes.map(s => ({
          size: s.size.trim(),
          quantity: Number(s.quantity),
        })),
        imageUrl: imageKey ?? null,
      }
      await createProduct(payload)
      setShowModal(false)
      setLoading(true)
      setProducts(await getProducts())
      setBrand(''); setCode(''); setColor(''); setCostPrice(''); setDescription(''); setSellPrice('');
      setSizes([]); setImageKey(null);  
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

    const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const API_KEY = process.env.NEXT_PUBLIC_IMAGES_API_KEY ?? '';

  async function fetchSignedUrlForKey(key: string) {
    const headers: Record<string,string> = {};
    if (API_KEY) headers['x-api-key'] = API_KEY;
    const res = await fetch(`/api/images?key=${encodeURIComponent(key)}`, { headers });
    if (!res.ok) {
      const t = await res.text().catch(()=>res.statusText);
      throw new Error(t || 'failed to get signed url');
    }
    const data = await res.json();
    return data.signedUrl as string;
  }

  useEffect(() => {
    if (products.length === 0) return;

    let mounted = true;
    const map: Record<string,string> = {};

    ;(async () => {
      await Promise.all(products.map(async (p) => {
        try {
          if (!p.imageUrl) return;
          // evita pedir si ya lo tenemos
          if (signedUrls[p.id]) {
            map[p.id] = signedUrls[p.id];
            return;
          }
          const signed = await fetchSignedUrlForKey(p.imageUrl);
          if (!mounted) return;
          map[p.id] = signed;
        } catch (e) {
          // no queremos romper la UI por un error de una sola imagen
          console.warn('no signed url for', p.id, e);
        }
      }));

      if (!mounted) return;
      setSignedUrls(prev => ({ ...prev, ...map }));
    })();

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]); 

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

          {/* <input
            type="number"
            placeholder="Precio min"
            value={filterMinPrice}
            onChange={e => setFilterMinPrice(e.target.value)}
            onKeyDown={preventMinus}
            onPaste={preventPasteNegative}
            min="0"
          />

          <input
            type="number"
            placeholder="Precio max"
            value={filterMaxPrice}
            onChange={e => setFilterMaxPrice(e.target.value)}
            onKeyDown={preventMinus}
            onPaste={preventPasteNegative}
            min="0"
          />

          <label>
            <input
              type="checkbox"
              checked={filterInStockOnly}
              onChange={e => setFilterInStockOnly(e.target.checked)}
            />
            Solo con stock
          </label> */}

          {/* <button type="button" onClick={() => {
            setFilterSearch(''); setFilterColor(''); setFilterSize('');
            setFilterMinPrice(''); setFilterMaxPrice(''); setFilterInStockOnly(false);
          }}>
            Limpiar
          </button> */}

        </form>
        <button className={styles.config_add_button} onClick={() => setShowModal(true)}>Añadir Producto</button>
      </section>
      <section className={styles.catalog}>
        {filteredProducts.map((product: any) => (
          <li key={product.id}  className={styles.product}
            // onClick={() => setSelectedProduct(product)}
          >
                    <h2 className={styles.product_title}>
                    {product.code}
                    </h2>
                    <div className={styles.product_image}>
                      {signedUrls[product.id] ? (
                        // uso <img> simple para evitar la restricción de dominios de next/image
                        <img
                          src={signedUrls[product.id]}
                          alt={product.code}
                          width={80}
                          height={100}
                          style={{ objectFit: 'cover', width: 80, height: 100 }}
                        />
                      ) : (
                        <Image src="/preview.png" alt="preview" width={80} height={100}/>
                      )}
                        {/* <Image src="/preview.png" alt="preview" width={80} height={100}/> */}
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
                                  <li key={s.size}>
                                      {s.size}
                                  </li>
                              ))}
                              </ul>
                          ) : (
                              <p>No hay tallas registradas.</p>
                          )}
                        </div>
                        <div>
                            <h3>
                                Cantidad
                            </h3>
                            <p>
                                {" "}
                                {product.sizes.reduce((sum: any, s: any) => sum + Number(s.quantity), 0)}
                            </p>
                        </div>
                        <div className={styles.product_options}>
                          
                          {/* <button className={styles.details_button}
                            // onClick={() => setSelectedProduct(product)}
                          >
                              Ver Detalles
                          </button> */}
                            <button
                              className={styles.update_button}
                              onClick={() => openEditModal(product)}
                              disabled={!!editLoading}
                            >
                              {editingProduct?.id === product.id && editLoading ? 'Guardando…' : 'Editar'}
                            </button>

                            <button
                              className={styles.delete_button}
                              onClick={() => handleDelete(product.id)}
                              disabled={deleteLoadingId === product.id}
                            >
                              {deleteLoadingId === product.id ? 'Borrando…' : 'Borrar'}
                            </button>
                        </div>
                    </div>
                </li>
        ))}
      </section>

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
                <fieldset className={styles.modal_form_metadata}>
                  <legend>Detalles</legend>
                  <div className={styles.input_wrapped}>
                    <input
                      placeholder="Código"
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      required
                    />
                  </div>                
                  <div className={styles.input_wrapped}>
                    <input
                      placeholder="Color"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.input_wrapped}>
                    <input
                      placeholder="Precio de costo"
                      type="number"
                      min="0"
                      onKeyPress={preventMinus}
                      onPaste={preventPasteNegative}
                      value={costPrice}
                      onChange={e => setCostPrice(e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.input_wrapped}>
                    <input
                      placeholder="Precio de venta"
                      type="number"
                      min="0"
                      value={sellPrice}
                      onChange={e => setSellPrice(e.target.value)}
                      required
                      onKeyPress={preventMinus}
                      onPaste={preventPasteNegative}  
                    />
                  </div>
                  <textarea
                    placeholder="Descripción"
                    value={description}
                    onChange={e => setDescription(e.target.value ?? '')}
                    required
                  />
                </fieldset>
                <fieldset className={styles.modal_form_sizes}>
                  <legend>Añadir Talla 
                    <button className={styles.modal_form_add_size} type="button" onClick={addSizeField}>
                      +
                    </button>
                  </legend>
                  <div className={styles.form_sizes_grid}>
                    {sizes.map((s, i) => (
                      <div key={i} className={styles.sizeRow}>
                        <div className={styles.input_wrapped}>
                          <input
                            placeholder="Talla"
                            value={s.size}
                            onChange={e => updateSize(i, 'size', e.target.value)}
                            required
                          />
                        </div>
                        <div className={styles.input_wrapped}>
                          <input
                            placeholder="Cantidad"
                            type="number"
                            value={s.quantity}
                            onChange={e => updateSize(i, 'quantity', e.target.value)}
                            required
                          />
                        </div>
                        <button type="button" onClick={() => removeSize(i)}>
                          ❌
                        </button>
                      </div>
                    ))}

                  </div>
                </fieldset>

                <button className={styles.modal_save_button} type="submit">
                  { loading ? 'Guardando' : 'Guardar Product' }
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
                  <input value={editCode} onChange={e => setEditCode(e.target.value)} placeholder="Código" />
                  <input value={editColor} onChange={e => setEditColor(e.target.value)} placeholder="Color" />
                  <input value={editCostPrice} onChange={e => setEditCostPrice(e.target.value)} placeholder="Precio costo" type="number" />
                  <input value={editSellPrice} onChange={e => setEditSellPrice(e.target.value)} placeholder="Precio venta" type="number" />
                  <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Descripción" />
                </fieldset>
                <fieldset className={styles.modal_edit_sizes }>
                  <legend><span>Tallas</span> <button type="button" onClick={() => setEditSizes(prev => [...prev, { size: '', quantity: 0 }])}>+</button>
                  </legend>
                    {editSizes.map((s, i) => (
                      <div key={i} className={styles.sizeRow}>
                        <input value={s.size} onChange={e => {
                          const copy = [...editSizes];
                          copy[i] = { ...copy[i], size: e.target.value };
                          setEditSizes(copy);
                        }} placeholder="Talla" />
                        <input value={String(s.quantity)} type="number" onChange={e => {
                          const copy = [...editSizes];
                          copy[i] = { ...copy[i], quantity: Number(e.target.value) };
                          setEditSizes(copy);
                        }} placeholder="Cantidad" />
                        <button type="button" onClick={() => setEditSizes(prev => prev.filter((_, idx) => idx !== i))}>❌</button>
                      </div>
                    ))}
                </fieldset>
                <fieldset className={styles.modal_edit_options}>
                  <legend>Options</legend>
                  <button type="submit" disabled={editLoading}>{editLoading ? 'Guardando…' : 'Guardar cambios'}</button>
                  <button type="button" onClick={() => { closeEditModal(); setShowModal(false); }}>Cancelar</button>
                </fieldset>
              </form>
            </div>
          </div>
      )}
    </>
  )
}

