"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "@/styles/inventory.module.css";
import Image from "next/image";
import "@/app/globals.css";
import { logoutAction } from "@/api/action";
import { useProductsRQ } from "@/hooks/useProductsRQ";
import { useQueryClient } from '@tanstack/react-query'

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
  // filtros UI
  const [filterSearch, setFilterSearch] = useState<string>("");
  const [filterBrand, setFilterBrand] = useState<string>("");
  const [filterColor, setFilterColor] = useState<string>("");
  const [filterSize, setFilterSize] = useState<string>("");
  const [filterMinPrice, setFilterMinPrice] = useState<string>("");
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>("");
  const [filterInStockOnly, setFilterInStockOnly] = useState<boolean>(false);

  // Debounce simple para filtros que se envían al servidor
  const [serverFilters, setServerFilters] = useState({
    brand: "",
    color: "",
    size: "",
    minPrice: "",
    maxPrice: "",
  });
  useEffect(() => {
    const t = setTimeout(() => {
      setServerFilters({
        brand: filterBrand.trim(),
        color: filterColor.trim(),
        size: filterSize.trim(),
        minPrice: filterMinPrice.trim(),
        maxPrice: filterMaxPrice.trim(),
      });
    }, 400);
    return () => clearTimeout(t);
  }, [filterBrand, filterColor, filterSize, filterMinPrice, filterMaxPrice]);

  // Hook paginado (usa el fetchPage que compartiste)
  const {
    data,
    error,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useProductsRQ({
    brand: serverFilters.brand || undefined,
    color: serverFilters.color || undefined,
    size: serverFilters.size || undefined,
    minPrice: serverFilters.minPrice || undefined,
    maxPrice: serverFilters.maxPrice || undefined,
  });

  // productos desde las páginas del hook (asumimos key `products`)
  const productsFromServer: Product[] = useMemo(() => {
    if (!data?.pages) return [];
    // tu backend devuelve `products` en cada página (según implementaciones previas)
    return data.pages.flatMap((p: any) => p.products || []);
  }, [data]);

  // Aplicar filtros cliente-side restantes: filterSearch y filterInStockOnly
  const visibleProducts = useMemo(() => {
    const s = (filterSearch ?? "").toString().trim().toLowerCase();
    const min = (() => {
      const t = (filterMinPrice ?? "").toString().trim();
      if (t === "") return null;
      const n = Number(t.replace(",", "."));
      return Number.isFinite(n) ? n : null;
    })();
    const max = (() => {
      const t = (filterMaxPrice ?? "").toString().trim();
      if (t === "") return null;
      const n = Number(t.replace(",", "."));
      return Number.isFinite(n) ? n : null;
    })();

    return productsFromServer.filter((p: any) => {
      // search por code/brand/description (cliente-side)
      if (s) {
        const code = (p.code ?? "").toString().toLowerCase();
        const brand = (p.brand ?? "").toString().toLowerCase();
        const desc = (p.description ?? "").toString().toLowerCase();
        if (!code.includes(s) && !brand.includes(s) && !desc.includes(s)) return false;
      }

      // precio (los valores del backend vienen en centavos)
      const price = Number(p.sellPrice ?? p.costPrice ?? 0) / 100;
      if (min !== null && price < min) return false;
      if (max !== null && price > max) return false;

      // talla (cliente-side, por si el backend no tiene availableSizes)
      if (filterSize.trim()) {
        const sizesLower = (p.sizes || []).map((item: any) => (item.size ?? "").toString().toLowerCase());
        if (!sizesLower.some((sv: string) => sv.includes(filterSize.trim().toLowerCase()))) return false;
      }

      // solo en stock
      if (filterInStockOnly) {
        const totalQty = (p.sizes || []).reduce((acc: number, s: any) => acc + Number(s.quantity || 0), 0);
        if (totalQty <= 0) return false;
      }

      return true;
    });
  }, [productsFromServer, filterSearch, filterSize, filterMinPrice, filterMaxPrice, filterInStockOnly]);

  // selected product for aside
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [ladate, setLadate] = useState("");
  useEffect(() => {
    if (selectedProduct != null) {
      // defensive: handle different timestamp shapes
      try {
        // si es Firestore Timestamp
        if (selectedProduct.updatedAt?.toDate) {
          const date = selectedProduct.updatedAt.toDate();
          setLadate(date.toLocaleDateString("en-GB"));
        } else if (selectedProduct.updatedAt?.seconds) {
          const msec = selectedProduct.updatedAt.seconds * 1000 + (selectedProduct.updatedAt.nanoseconds || 0) / 1e6;
          setLadate(new Date(msec).toLocaleDateString("en-GB"));
        } else if (typeof selectedProduct.updatedAt === "number") {
          setLadate(new Date(selectedProduct.updatedAt).toLocaleDateString("en-GB"));
        } else {
          // fallback
          const d = new Date(selectedProduct.updatedAt);
          if (!Number.isNaN(d.valueOf())) setLadate(d.toLocaleDateString("en-GB"));
        }
      } catch (e) {
        setLadate("");
      }
    }
  }, [selectedProduct]);

  // signed urls caching
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const API_KEY = process.env.NEXT_PUBLIC_IMAGES_API_KEY ?? "";

  async function fetchSignedUrlForKey(key: string) {
    const headers: Record<string, string> = {};
    if (API_KEY) headers["x-api-key"] = API_KEY;
    const res = await fetch(`/api/images?key=${encodeURIComponent(key)}`, { headers });
    if (!res.ok) {
      const t = await res.text().catch(() => res.statusText);
      throw new Error(t || "failed to get signed url");
    }
    const data = await res.json();
    return data.signedUrl as string;
  }

  useEffect(() => {
    if (visibleProducts.length === 0) return;
    let mounted = true;
    const map: Record<string, string> = {};

    (async () => {
      await Promise.all(
        visibleProducts.map(async (p) => {
          try {
            if (!p.imageUrl) return;
            if (signedUrls[p.id]) {
              map[p.id] = signedUrls[p.id];
              return;
            }
            const signed = await fetchSignedUrlForKey(p.imageUrl);
            if (!mounted) return;
            map[p.id] = signed;
          } catch (e) {
            console.warn("no signed url for", p.id, e);
          }
        })
      );

      if (!mounted) return;
      setSignedUrls((prev) => ({ ...prev, ...map }));
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleProducts]);

  // logout (tu implementación)
  const handleLogout = () => {
    localStorage.removeItem("token");
    // si usas next/navigation push, importa y úsalo
    // router.push('/')
    // aquí solo recargamos o redirigimos:
    window.location.href = "/";
  };

  // if (error) return <p>Error al cargar: {(error as Error).message}</p>;

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
              placeholder="Proveedor"
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
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

        {visibleProducts && visibleProducts.length === 0 && <p>No hay productos que coincidan.</p>}

        <ul className={styles.list_products}>
          {isLoading && <p>Cargando inventario…</p>}

          {visibleProducts?.map((product: any) => (
            <li key={product.id} onClick={() => setSelectedProduct(product)}>
              <h2>{product.code}</h2>
              <div className={styles.product_image}>
                {signedUrls[product.id] ? (
                  <img
                    src={signedUrls[product.id]}
                    alt={product.code}
                    width={80}
                    height={100}
                    style={{ objectFit: "cover", width: 80, height: 100 }}
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
                  <p>{product.sizes ? product.sizes.reduce((sum: number, s: any) => sum + Number(s.quantity), 0) : 0}</p>
                </div>

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

        <div style={{ textAlign: "center", margin: 20 }}>
          {hasNextPage ? (
            <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? "Cargando…" : "Cargar más"}
            </button>
          ) : (
            <p>{isLoading ? "" : "No hay más productos"}</p>
          )}
        </div>
      </main>

      <aside className={styles.aside}>
        {selectedProduct ? (
          <>
            <h2>Detalles de: {selectedProduct.code}</h2>
            <p>
              <strong>Proveedor:</strong> {selectedProduct.brand}
            </p>
            <p>
              <strong>Color:</strong> {selectedProduct.color}
            </p>
            <p>
              <strong>Precio de venta:</strong> {money((selectedProduct.sellPrice ?? 0) / 100)}
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
            {selectedProduct.updatedAt && <p className="text-sm text-gray-500">Última actualización: {ladate}</p>}
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
