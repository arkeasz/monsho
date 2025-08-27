"use client";

import { getReports } from "@/api/daily";
import styles from "@styles/history.module.css";
import { useEffect, useState } from "react";

interface Report {
  id: string;
  date: string; // formato YYYY-MM-DD
  totalSales: number;
  totalExpenses: number;
  utilities: number;
}

export default function Home() {
  const [reports, setReports] = useState<{ items: Report[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReports() {
      try {
        setLoading(true);
        const data = await getReports();
        setReports(data);
      } catch (err: any) {
        setError(err.message ?? "Error al cargar los reportes");
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, []);

  const money = (n: unknown) => {
    const value = typeof n === "number" && Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (loading) return <p className={styles.loading}>Cargando reportes...</p>;
  if (error) return <p className={styles.error}>Error: {error}</p>;
  if (!reports || reports.items.length === 0)
    return <p>No hay reportes recientes.</p>;

  // Agrupar reportes por mes
  const monthReports = reports.items.reduce<Record<string, Report[]>>(
    (acc, report) => {
      const month = report.date.slice(0, 7); // "YYYY-MM"
      if (!acc[month]) acc[month] = [];
      acc[month].push(report);
      return acc;
    },
    {}
  );

  return (
    <section className={styles.container}>
      <h1>Reportes diarios</h1>

      {Object.entries(monthReports).map(([month, reports]) => (
        <div key={month} className={styles.month_section}>
          <h2>{month}</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Total Ventas</th>
                <th>Gastos</th>
                <th>Utilidades</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{money(r.totalSales/100)}</td>
                  <td>{money(r.totalExpenses/100)}</td>
                  <td>{money(r.utilities/100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
