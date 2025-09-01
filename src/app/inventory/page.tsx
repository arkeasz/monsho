"use client";

import useSWR from "swr";
import { getProducts } from "@/api/products";
import { useRouter } from "next/navigation";
import styles from "@/styles/inventory.module.css";
import Image from "next/image";
import "@/app/globals.css";
import React, { useEffect, useMemo, useState } from "react";
import { logoutAction } from "@/api/action";

type SizeInfo = any;
type Product = any;

const money = (n: unknown) => {
  const value = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 2,
  }).format(value);
};

export default function Home() {
  const router = useRouter();

  const { data, error, isLoading } = useSWR<any[]>("listProducts", () => getProducts(), {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
  });

  const products = data ?? [];

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/");
  };

  // selected product para el aside
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [ladate, setLadate] = useState('')
  useEffect(() => {
    if (selectedProduct != null) {
      const ts = { sec: selectedProduct.updatedAt.valueOf()._seconds, nan: selectedProduct.updatedAt.valueOf()._nanoseconds }
      const milliseconds = ts.sec*1000 + ts.nan / 1e6;
      const date = new Date(milliseconds)
      setLadate(date.toLocaleDateString('en-GB'))
    }
  }, [selectedProduct])

  // filtros controlados (cliente)
  const [filterSearch, setFilterSearch] = useState<string>("");
  const [filterBrand, setFilterBrand] = useState<string>("");
  const [filterColor, setFilterColor] = useState<string>("");
  const [filterSize, setFilterSize] = useState<string>("");
  const [filterMinPrice, setFilterMinPrice] = useState<string>(""); // en unidades (ej. 12.50)
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>(""); // en unidades
  const [filterInStockOnly, setFilterInStockOnly] = useState<boolean>(false);

  // helper: formatea centavos -> string en unidades con 2 decimales
  const formatPrice = (cents: number | null | undefined) => {
    const n = Number(cents ?? 0) / 100;
    // usa la locale del usuario; se puede forzar 'es-PE' si quieres
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // useMemo: filtrado robusto (adaptado para centavos)
  const filteredProducts = useMemo(() => {
    const s = (filterSearch ?? "").toString().trim().toLowerCase();
    const b = (filterBrand ?? "").toString().trim().toLowerCase();
    const c = (filterColor ?? "").toString().trim().toLowerCase();
    const sz = (filterSize ?? "").toString().trim().toLowerCase();

    const parseMaybeNumber = (raw: string): number | null => {
      const t = (raw ?? "").toString().trim();
      if (t === "") return null;
      const normalized = t.replace(",", ".");
      const n = Number(normalized);
      return Number.isFinite(n) ? n : null;
    };

    // min/max en unidades (ej. 12.5) -> convertimos a centavos para comparar con la API
    const min = parseMaybeNumber(filterMinPrice);
    const max = parseMaybeNumber(filterMaxPrice);
    const minCents = min !== null ? Math.round(min * 100) : null;
    const maxCents = max !== null ? Math.round(max * 100) : null;

    return (products || []).filter((p: any) => {
      // search por code/brand/description
      if (s) {
        const code = (p.code ?? "").toString().toLowerCase();
        const brand = (p.brand ?? "").toString().toLowerCase();
        const desc = (p.description ?? "").toString().toLowerCase();
        if (!code.includes(s) && !brand.includes(s) && !desc.includes(s)) return false;
      }

      // brand
      if (b) {
        const brand = (p.brand ?? "").toString().toLowerCase();
        if (!brand.includes(b)) return false;
      }

      // color
      if (c) {
        const color = (p.color ?? "").toString().toLowerCase();
        if (!color.includes(c)) return false;
      }

      // precio: la API viene en centavos, usamos directamente sellPrice/costPrice
      const priceCents = Number(p.sellPrice ?? p.costPrice ?? 0);
      if (minCents !== null && priceCents < minCents) return false;
      if (maxCents !== null && priceCents > maxCents) return false;

      if (sz) {
        const sizesLower = (p.sizes || []).map((item: any) =>
          (item.size ?? "").toString().toLowerCase()
        );
        if (!sizesLower.some((sv: string) => sv.includes(sz))) return false;
      }

      // solo en stock: sumar cantidades
      if (filterInStockOnly) {
        const totalQty = (p.sizes || []).reduce((acc: number, s: any) => acc + Number(s.quantity || 0), 0);
        if (totalQty <= 0) return false;
      }

      return true;
    });
  }, [
    products,
    filterSearch,
    filterBrand,
    filterColor,
    filterSize,
    filterMinPrice,
    filterMaxPrice,
    filterInStockOnly,
  ]);

  
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
  

  if (isLoading) return <p>Cargando inventario…</p>;
  if (error) return <p>Error al cargar: {(error as Error).message}</p>;

  return (
    <>
      <header className={styles.header}>
        <h1>Inventario de Productos</h1>
        <form action={logoutAction}>
          <button type="submit" className={styles.logout_button}>
            CERRAR SESIÓN
          </button>
        </form>
      </header>

      <main className={styles.main}>
        <div className={styles.filters_container}>
        <div className={styles.filters_form} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Buscar por código, marca o descripción"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className={styles.filter_input}
          />
          <input
            type="text"
            placeholder="Color"
            value={filterColor}
            onChange={(e) => setFilterColor(e.target.value)}
            className={styles.filter_input}
          />
          <input
            type="text"
            placeholder="Talla"
            value={filterSize}
            onChange={(e) => setFilterSize(e.target.value)}
            className={styles.filter_input}
          />
          <input
            type="text"
            placeholder="Precio min (S/. — ej. 12.50)"
            value={filterMinPrice}
            onChange={(e) => setFilterMinPrice(e.target.value)}
            className={styles.filter_input}
          />
          <input
            type="text"
            placeholder="Precio max (S/. — ej. 99.99)"
            value={filterMaxPrice}
            onChange={(e) => setFilterMaxPrice(e.target.value)}
            className={styles.filter_input}
          />
          <input
            type="text"
            placeholder="Proveedor"
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className={styles.filter_input}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={filterInStockOnly}
              onChange={(e) => setFilterInStockOnly(e.target.checked)}
            />
            Sólo en stock
          </label>

          <div style={{ display: "inline-flex", gap: 8 }}>
            <button
              type="button"
              className={styles.filter_button}
              onClick={() => {
                // reset filtros
                setFilterSearch("");
                setFilterBrand("");
                setFilterColor("");
                setFilterSize("");
                setFilterMinPrice("");
                setFilterMaxPrice("");
                setFilterInStockOnly(false);
                setSelectedProduct(null);
              }}
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

        {filteredProducts && filteredProducts.length === 0 && <p>No hay productos que coincidan.</p>}
        <ul className={styles.list_products}>
          {filteredProducts?.map((product: any) => (
            <li key={product.id} onClick={() => setSelectedProduct(product)}>
              <h2>{product.code}</h2>
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
                  <Image src="/preview.png" alt="preview" width={80} height={100}/>
                )}
                {/* <Image src="/preview.png" alt="preview" width={80} height={100} /> */}
              </div>
              <div className={styles.product_details}>
                <div>
                  <h3>Color</h3>
                  <p>{product.color}</p>
                </div>

                <div>
                  <h3>Tallas</h3>
                  {product.sizes && product.sizes.length > 0 ? (
                    <ul className="list-disc list-inside">
                      {product.sizes.map((s: any) => (
                        <span key={s.size}>{s.size}</span>
                      ))}
                    </ul>
                  ) : (
                    <p>No hay tallas registradas.</p>
                  )}
                </div>

                <div>
                  <h3>Cantidad</h3>
                  <p>
                    {product.sizes
                      ? product.sizes.reduce((sum: number, s: any) => sum + Number(s.quantity), 0)
                      : 0}
                  </p>
                </div>

                {/* <div>
                  <h3>Precio</h3>
                  <p>S/.{formatPrice(product.sellPrice ?? product.costPrice ?? 0)}</p>
                </div> */}

                <button
                  className={styles.details_button}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProduct(product);
                  }}
                >
                  Ver Detalles
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>

      <aside className={styles.aside}>
        {selectedProduct ? (
          <>
            <h2>Detalles de: {selectedProduct.code}</h2>
            <p>
              <strong>Proveedor:</strong> {selectedProduct.brand}
            </p>            <p>
              <strong>Color:</strong> {selectedProduct.color}
            </p>
            <p>
              <strong>Precio de venta:</strong> {money(selectedProduct.sellPrice/100)}
            </p>
            <div>
              <h3>Tallas y cantidades:</h3>
              <ul className="list-disc list-inside">
                {selectedProduct.sizes?.map((s: any) => (
                  <li key={s.size}>
                    {s.size}: {s.quantity}
                  </li>
                ))}
              </ul>
            </div>
            {selectedProduct.updatedAt && (
              <p className="text-sm text-gray-500">
                Última actualización: {ladate}
              </p>
            )}
          </>
        ) : (
          <>
            <h2>Información de Producto</h2>
            <p>Selecciona un producto para ver más detalles.</p>
          </>
        )}
      </aside>
    </>
  );
}