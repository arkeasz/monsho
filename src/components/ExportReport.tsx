"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { utils as XLSXUtils } from "xlsx";

function getTodayISO(): string {
  try {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Lima" });
  } catch {
    const now = new Date();
    const lima = new Date(now.getTime() + (-5 - now.getTimezoneOffset() / 60) * 3600 * 1000);
    const yyyy = lima.getUTCFullYear();
    const mm = String(lima.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(lima.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
}

async function tryGetFirebaseToken(): Promise<string | null> {
  try {
    // Intenta obtener token si firebase está disponible globalmente (no obligatorio)
    const w: any = window as any;
    if (w.firebase && typeof w.firebase.auth === "function") {
      const user = w.firebase.auth().currentUser;
      if (user && typeof user.getIdToken === "function") {
        return await user.getIdToken();
      }
    }
  } catch (err) {
    // no hacemos nada, devolvemos null
  }
  return null;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function ExportReport() {
  const [endDate, setEndDate] = useState<string>(getTodayISO());
  const [days, setDays] = useState<number>(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const FUNCTIONS_BASE = (process.env.NEXT_PUBLIC_FUNCTIONS_URL || "").replace(/\/$/, "");

  async function fetchCsvText(end: string, daysCount: number): Promise<string> {
    if (!FUNCTIONS_BASE) throw new Error("NEXT_PUBLIC_FUNCTIONS_URL no configurada");
    const token = await tryGetFirebaseToken();

    const url = `${FUNCTIONS_BASE}/report/export?end=${encodeURIComponent(end)}&days=${encodeURIComponent(
      String(daysCount)
    )}`;

    const headers: Record<string, string> = { Accept: "text/csv" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, { method: "GET", headers });
    if (!res.ok) {
      const text = await res.text().catch(() => null);
      throw new Error(text || `Error ${res.status} al generar CSV`);
    }
    // Leemos como blob para respetar el encoding/BOM
    const blob = await res.blob();
    return await blob.text();
  }

  const onDownloadCsv = async () => {
    setError(null);
    setLoading(true);
    try {
      const csvText = await fetchCsvText(endDate, days);
      const normalized = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
      // añadimos BOM explícito para compatibilidad Excel Windows
      const blob = new Blob(["\uFEFF" + normalized], { type: "text/csv;charset=utf-8;" });
      const filename = `export_${endDate}_last${days}.csv`;
      downloadBlob(blob, filename);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Error al descargar CSV");
    } finally {
      setLoading(false);
    }
  };

  const onDownloadXlsx = async () => {
    setError(null);
    setLoading(true);
    try {
      const csvText = await fetchCsvText(endDate, days);
      const normalized = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
      // Convert CSV -> worksheet -> workbook
      const rows = normalized.split("\n").map(row => row.split(","));
      const ws = XLSXUtils.aoa_to_sheet(rows);
      const wb = XLSXUtils.book_new();
      XLSXUtils.book_append_sheet(wb, ws, "Report");
      XLSX.utils.book_append_sheet(wb, ws, "Report");

      // Escribir a array buffer y descargar
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      const filename = `export_${endDate}_last${days}.xlsx`;
      downloadBlob(blob, filename);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Error al generar XLSX");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md">
      <h3 className="mb-2 text-lg font-medium">Exportar reportes</h3>

      <label className="block mb-2">
        <span className="text-sm">Fecha final (America/Lima)</span>
        <input
          type="date"
          value={endDate}
          max={getTodayISO()}
          onChange={(e) => setEndDate(e.target.value)}
          className="mt-1 block w-full px-2 py-1 border rounded"
        />
      </label>

      <label className="block mb-4">
        <span className="text-sm">Últimos días (1–15)</span>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="mt-1 block w-full px-2 py-1 border rounded"
        >
          {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} día{n > 1 ? "s" : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2">
        <button
          onClick={onDownloadCsv}
          disabled={loading || !FUNCTIONS_BASE}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
        >
          {loading ? "Generando..." : "Descargar CSV"}
        </button>

        <button
          onClick={onDownloadXlsx}
          disabled={loading || !FUNCTIONS_BASE}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-60"
        >
          {loading ? "Generando..." : "Descargar XLSX"}
        </button>
      </div>

      {!FUNCTIONS_BASE && (
        <p className="mt-2 text-sm text-yellow-700">
          ERROR: no encontré la variable <code>NEXT_PUBLIC_FUNCTIONS_URL</code>.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">Error: {error}</p>}

      <p className="mt-3 text-xs text-gray-500">
        El archivo incluirá los dailyReports del rango seleccionado y las columnas por tienda.
      </p>
    </div>
  );
}
