"use client";
import React, { useEffect, useState } from "react";
import styles from "@styles/sells.module.css";
import { RegisterSalePayload } from "@/types/sales";
import { registerSale } from "@/api/sales";

import {
  getStores,
  createStore,
  updateStore,
  deleteStore,
} from "@/api/stores";

import { Store as StoreType } from "@/types/store"; 
import EmployeesAdmin from "@/components/EmployeesAdmin";
import OtherExpensesTable from "@/components/OtherExpenses";
import ImagesUpload from '@/components/ImagesUpload'
import DailyReport from "@/components/DailyReport";


type LocalStoreRow = {
  localId: string; 
  id: string; 
  mensual: string; 
  diario: string; 
  isNew?: boolean;
  saving?: boolean;
};

export default function Home() {
  // ---- Form para ventas ----
  const [code, setCode] = useState("");
  const [storeId, setStoreId] = useState(1219);
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState("28");
  const [loadingSale, setLoadingSale] = useState(false);
  const [errorSale, setErrorSale] = useState<string | null>(null);
  const [successSale, setSuccessSale] = useState<string | null>(null);

  // ---- Grid de tiendas ----
  const [tiendas, setTiendas] = useState<LocalStoreRow[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [errorStores, setErrorStores] = useState<string | null>(null);

  // Fetch stores al montar o cuando hagamos refresh
  const fetchStores = async () => {
    setLoadingStores(true);
    setErrorStores(null);
    try {
      const stores = await getStores();
      // normalizar a LocalStoreRow
      const rows: LocalStoreRow[] = stores.map((s) => ({
        localId: s.id?.toString() ?? `${Math.random().toString(36).slice(2)}`,
        id: s.id?.toString() ?? "",
        mensual: (s.rentMonthly ?? "").toString(),
        diario: (s.rentDaily ?? "").toString(),
        isNew: false,
      }));
      setTiendas(rows);
    } catch (err: any) {
      console.error("Error cargando stores:", err);
      setErrorStores(err.message || "Error cargando tiendas");
    } finally {
      setLoadingStores(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  // ---- Handlers CRUD ----
  const handleAddRow = () => {
    const tempId = `new-${Date.now()}`;
    setTiendas((prev) => [
      ...prev,
      { localId: tempId, id: "", mensual: "", diario: "", isNew: true },
    ]);
  };

  const handleRowChange = (localId: string, field: keyof LocalStoreRow, value: string) => {
    setTiendas((prev) => prev.map(r => r.localId === localId ? { ...r, [field]: value } : r));
  };

  const handleSaveRow = async (row: LocalStoreRow) => {
    // Validaciones mínimas
    if (!row.id || row.id.trim() === "") {
      // For create we require an id (según tu preferencia). Si no quieres id obligatorio,
      // quita esta validación y deja que backend genere.
      // Aquí permito crear con id vacío (backend generará uno automático) — si quieres forzarlo, descomenta:
      // return alert('ID de tienda es obligatorio');
    }
    const rentMonthly = Number(row.mensual || 0);
    try {
      // marcar saving en UI
      setTiendas(prev => prev.map(r => r.localId === row.localId ? { ...r, saving: true } : r));
      if (row.isNew) {
        // Crear
        await createStore({
          id: row.id || undefined,
          rentMonthly,
        });
      } else {
        // Actualizar
        if (!row.id) throw new Error("La tienda no tiene id para actualizar");
        await updateStore(row.id, { rentMonthly });
      }
      // refrescar lista
      await fetchStores();
    } catch (err: any) {
      console.error("Error guardando fila:", err);
      setErrorStores(err.message || "Error guardando tienda");
      // quitar saving flag
      setTiendas(prev => prev.map(r => r.localId === row.localId ? { ...r, saving: false } : r));
    }
  };

  const handleDeleteRow = async (row: LocalStoreRow) => {
    if (!row.id) {
      // si es fila local no persistida, sólo la quitamos
      setTiendas(prev => prev.filter(r => r.localId !== row.localId));
      return;
    }
    if (!confirm(`Eliminar tienda ${row.id}?`)) return;
    try {
      await deleteStore(row.id);
      await fetchStores();
    } catch (err: any) {
      console.error("Error eliminando tienda:", err);
      setErrorStores(err.message || "Error eliminando tienda");
    }
  };

  // ---- Handler Registrar Venta ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSale(true);
    setErrorSale(null);
    setSuccessSale(null);
    try {
      const payload: RegisterSalePayload = {
        productCode: code,
        storeId,
        quantity,
        size,
      };
      const result = await registerSale(payload);
      // si registerSale devuelve {message}
      setSuccessSale(result?.message || "Venta registrada");
      // refrescar stores/reports si hace falta (no es obligatorio aquí)
      await fetchStores();
      // limpiar formulario
      setCode("");
      setQuantity(1);
    } catch (err: any) {
      console.error("Error registrando venta:", err);
      setErrorSale(err.message || "Error registrando venta");
    } finally {
      setLoadingSale(false);
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.sale}>
        {errorSale && <div className="text-red-600">{errorSale}</div>}
        {successSale && <div className="text-green-600">{successSale}</div>}
        <div>
          <label>Código de producto</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="border p-2 rounded w-full"
          />
        </div>
        <div>
          <label>Tienda</label>
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
        <div>
          <label>Cantidad</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            required
          />
        </div>
        <div>
          <label>Talla</label>
          <input
            type="text"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            required
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

      <OtherExpensesTable />
      <DailyReport />
    </div>
  );
}