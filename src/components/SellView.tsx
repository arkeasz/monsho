'use client';
import React, { useEffect, useRef, useState } from "react";
import styles from "@styles/sells.module.css";
import { registerSale } from "@/api/sales";

export default function SellView() {
  const [code, setCode] = useState("");
  const [storeId, setStoreId] = useState(1219);
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState("28");
  const [appliedPrice, setAppliedPrice] = useState<number>(0);
  const [loadingSale, setLoadingSale] = useState(false);
  const [errorSale, setErrorSale] = useState<string | null>(null);
  const [successSale, setSuccessSale] = useState<string | null>(null);

  // PAYMENT: opciones y estado
  const PAYMENT_OPTIONS = ['visa', 'yape', 'transferencia', 'efectivo'];
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_OPTIONS[0]);

  // --- draggable ---
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: 20, y: 60 }); // posición inicial

  // evita iniciar arrastre cuando el target es un control interactivo
  const isInteractiveTarget = (el: EventTarget | null) => {
    if (!(el instanceof Element)) return false;
    const tag = el.tagName.toLowerCase();
    if (['input', 'textarea', 'select', 'button', 'a', 'label'].includes(tag)) return true;
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') return true;
    return false;
  };

  const startDrag = (clientX: number, clientY: number) => {
    draggingRef.current = true;
    offsetRef.current = { x: clientX - pos.x, y: clientY - pos.y };
    // listeners globales
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // no iniciar arrastre si el objetivo es interactivo
    if (isInteractiveTarget(e.target)) return;
    // sólo respuesta a botón primario
    if (e.button && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  };

  const onPointerMove = (ev: PointerEvent) => {
    if (!draggingRef.current) return;
    const nx = ev.clientX - offsetRef.current.x;
    const ny = ev.clientY - offsetRef.current.y;
    setPos(constrainToViewport(nx, ny));
  };

  const onPointerUp = (ev?: PointerEvent) => {
    draggingRef.current = false;
    pointerIdRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  };

  const constrainToViewport = (nx: number, ny: number) => {
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const el = containerRef.current;
    if (!el) return { x: nx, y: ny };
    const rect = el.getBoundingClientRect();
    let x = nx;
    let y = ny;
    if (x < margin) x = margin;
    if (x + rect.width > vw - margin) x = vw - rect.width - margin;
    if (y < margin) y = margin;
    if (y + rect.height > vh - margin) y = vh - rect.height - margin;
    return { x, y };
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- handle submit (igual que tu implementation original) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSale(true);
    setErrorSale(null);
    setSuccessSale(null);

    if (!code.trim()) {
      setErrorSale("Ingresa el código del producto.");
      setLoadingSale(false);
      return;
    }
    if (!Number.isFinite(storeId)) {
      setErrorSale("Selecciona una tienda válida.");
      setLoadingSale(false);
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setErrorSale("Cantidad inválida.");
      setLoadingSale(false);
      return;
    }
    if (!size.trim()) {
      setErrorSale("Indica la talla.");
      setLoadingSale(false);
      return;
    }

    // validar paymentMethod
    if (!paymentMethod || typeof paymentMethod !== 'string' || !paymentMethod.trim()) {
      setErrorSale('Selecciona un método de pago.');
      setLoadingSale(false);
      return;
    }

    const payload: any = {
      productCode: code.trim(),
      storeId,
      quantity,
      size: String(size).trim(),
      paymentMethod: String(paymentMethod).trim(),
    };

    if (appliedPrice !== 0) {
      const parsed = Number(appliedPrice);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setErrorSale("Precio aplicado inválido.");
        setLoadingSale(false);
        return;
      }
      payload.appliedPrice = parsed;
    }

    try {
      console.log('registerSale payload:', payload);
      const result = await registerSale(payload);
      setSuccessSale(result?.message || "Venta registrada");
      setCode("");
      setQuantity(1);
      setSize("28");
      setAppliedPrice(0);
    } catch (err: any) {
      console.error("Error registrando venta:", err);
      setErrorSale(err?.message || "Error registrando venta");
    } finally {
      setLoadingSale(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={styles.container}
      // hacemos que el container sea "flotante" y movible por toda la página
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        touchAction: 'none', // mejora la interacción táctil con pointer events
      }}
      onPointerDown={onPointerDown}
    >
      <form onSubmit={handleSubmit} className={styles.sale}>
        {errorSale && <div style={{ color: 'red' }}>{errorSale}</div>}
        {successSale && <div style={{ color: 'green' }}>{successSale}</div>}

        <div>
          <label>Código de producto</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            placeholder="Ej: ABC123"
          />
        </div>

        <div className="mb-3">
          <label className="block mb-1">Tienda</label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(Number(e.target.value))}
            className="border p-2 rounded w-full"
          >
            {[1219, 1274, 1374, 1375].map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="block mb-1">Cantidad</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            required
            className="border p-2 rounded w-full"
          />
        </div>

        <div className="mb-3">
          <label className="block mb-1">Talla</label>
          <input
            type="text"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            required
            className="border p-2 rounded w-full"
          />
        </div>

        <div>
          <label>Método de pago</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="border p-2 rounded w-full mb-3"
            required
          >
            {PAYMENT_OPTIONS.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Precio aplicado (opcional)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={appliedPrice}
            onChange={(e) => setAppliedPrice(Number(e.target.value))}
            placeholder="Ej: 15.9"
          />
        </div>

        <button
          type="submit"
          disabled={loadingSale}
          className={styles.sale_button}
        >
          {loadingSale ? "Registrando..." : "Agregar Venta"}
        </button>
      </form>
    </div>
  );
}