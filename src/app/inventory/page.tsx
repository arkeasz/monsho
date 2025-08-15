"use client";

import useSWR from "swr";
import { apiRequest } from "@/api/utils";
import { useRouter } from 'next/navigation';
import styles from '@/styles/inventory.module.css';
import Image from 'next/image';
import '@/app/globals.css';
import { useState } from 'react'


interface SizeInfo {
  size: string;
  quantity: number;
}

interface Product {
  id: string;
  brand: string;
  code: string;
  color: string;
  costPrice: number;
  description: string;
  sellPrice: number;
  sizes: SizeInfo[];
  updatedAt?: string;
}

const fetcher = <T,>(path: string) => apiRequest<T[]>(path, {});

export default function Home() {
    const router = useRouter();
    const { data, error, isLoading } = useSWR<Product[]>("listProducts", fetcher, {
        revalidateOnFocus: false,
        revalidateIfStale: false,
        revalidateOnReconnect: false,
    });
    const handleLogout = () => {
        localStorage.removeItem("token");
        router.push("/"); 
    };
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    if (isLoading) return <p>Cargando inventario…</p>;
    if (error) return <p>Error al cargar: {(error as Error).message}</p>;

    return (
        <>
            <header className={styles.header}>
                <h1>Inventario de Productos</h1>
                <button onClick={handleLogout}>CERRAR SESIÓN</button>
            </header>
            <main className={styles.main}>
            {data && data.length === 0 && <p>No hay productos en inventario.</p>}
            <ul className={styles.list_products}>
                {data?.map((product) => (
                <li key={product.id} onClick={() => setSelectedProduct(product)}>

                    <h2>
                    {product.code}
                    </h2>
                    <div className={styles.product_image}>
                        <Image src="/preview.png" alt="preview" width={80} height={100}/>
                    </div>
                    <div className={styles.product_details}>
                        <div>
                            <h3>Color</h3>
                            <p>{product.color}</p>
                        </div>

                        <div>
                        <h3>Tallas</h3>
                        {product.sizes.length > 0 ? (
                            <ul className="list-disc list-inside">
                            {product.sizes.map((s) => (
                                <span key={s.size}>
                                    {s.size}
                                </span>
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
                            {product.sizes.reduce((sum, s) => sum + Number(s.quantity), 0)}
                            </p>
                        </div>
                        <button className={styles.details_button} onClick={() => setSelectedProduct(product)}>
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
                            <strong>Marca:</strong> {selectedProduct.brand}
                            </p>
                            <p>
                            <strong>Descripción:</strong> {selectedProduct.description}
                            </p>
                            <p>
                            <strong>Precio de venta:</strong> S/.{selectedProduct.sellPrice}
                            </p>
                            <div>
                            <h3>Tallas y cantidades:</h3>
                            <ul className="list-disc list-inside">
                                {selectedProduct.sizes.map((s) => (
                                <li key={s.size}>
                                    {s.size}: {s.quantity}
                                </li>
                                ))}
                            </ul>
                            </div>
                            {selectedProduct.updatedAt && (
                            <p className="text-sm text-gray-500">
                                Última actualización:{" "}
                                {new Date(selectedProduct.updatedAt).toLocaleString()}
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