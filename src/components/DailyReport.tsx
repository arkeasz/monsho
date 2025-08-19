"use client";

import styles from "@styles/daily.module.css";
import { useEffect, useState } from "react";
import { getReportByDate, updateReport } from "@/api/daily";

export default function DailyReport() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true);
        const today = new Date().toLocaleDateString('sv-SE', { 
            timeZone: 'America/Lima' 
        });   
        const data = await getReportByDate(today);
        setReport(data);
      } catch (err: any) {
        setError(err.message || "Error al cargar el reporte");
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  const money = (n: unknown) => {
    const value = typeof n === "number" && Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
      maximumFractionDigits: 2,
    }).format(value);
  };

  function formatTimestamp(ts: any) {
    if (!ts) return null;
    if (typeof ts === "object" && ts.seconds) {
      return new Date(ts.seconds * 1000).toLocaleString("es-PE");
    }
    const parsed = Date.parse(ts);
    if (!Number.isNaN(parsed)) return new Date(parsed).toLocaleString("es-PE");
    if (typeof ts === "number") return new Date(ts).toLocaleString("es-PE");
    return String(ts);
  }

  const [updating, setUpdating] = useState(false);

  const handleUpdateUtilities = async () => {
    try {
      setUpdating(true);
      const calculatedUtilities = totalSales - totalExpenses;
      
      const updatedReport: any = await updateReport(dateLabel, calculatedUtilities);
      
      // Actualizamos el estado con la respuesta
      setReport((prev: any) => ({
        ...prev,
        utilities: calculatedUtilities,
        updatedAt: updatedReport.updatedAt
      }));
    } catch (err: any) {
      setError(err.message || "Error al actualizar utilidades");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className={styles.loading}>Cargando reporte...</div>;
  if (error) return <div className={styles.error}>Error: {error}</div>;
  if (!report) return <div className={styles.empty}>No hay datos para hoy.</div>;

  const dateLabel = report.date ?? new Date().toISOString().split("T")[0];
  const storeTotals = report.storeTotals ?? {};
  const storeEntries = Object.entries(storeTotals) as [string, number][];

  const totalSales =
    typeof report.totalSales === "number"
      ? report.totalSales
      : storeEntries.reduce((s, [, v]) => s + (typeof v === "number" ? v : 0), 0);

  const totalExpenses = typeof report.totalExpenses === "number" ? report.totalExpenses : 0;
  const utilities = totalSales - totalExpenses;

  const updatedAt = formatTimestamp(report.updatedAt ?? report.createdAt);

  return (
    <div className={styles.container}>
      <div className={styles.container_top}>
        <h1>Reporte diario para <span className={styles.date}>{dateLabel}</span></h1>
        {/* {updatedAt && <small className={styles.updated}>Última actualización: {updatedAt}</small>} */}
      </div>
      <div className={styles.container_body}>
        <section className={styles.section}>
          <h2 className={styles.subtitle}>Total de ventas por tienda</h2>

          {storeEntries.length === 0 ? (
            <p className={styles.noStores}>No hay ventas registradas por tienda.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tienda</th>
                  <th style={{ textAlign: "right" }}>Ventas</th>
                </tr>
              </thead>
              <tbody>
                {storeEntries.map(([store, val]) => (
                  <tr key={store}>
                    <td>{store}</td>
                    <td style={{ textAlign: "right" }}>{money(val)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.summary}>
          <h2>Resumen</h2>
          <div className={styles.row}>
            <span>Total de ventas: </span>
            <strong>{money(totalSales)}</strong>
          </div>
          <div className={styles.row}>
            <span>Total de gastos: </span>
            <strong>{money(totalExpenses)}</strong>
          </div>
          <div className={styles.row}>
            <span>Utilidades: </span>
            <strong>{money(utilities)}</strong>
          </div>
          
          <button 
            onClick={handleUpdateUtilities}
            disabled={updating}
          >
            {updating ? "Guardando..." : "Actualizar Utilidades"}
          </button>
        </section>
      </div>
    </div>
  );
}
