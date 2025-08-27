"use client";

import { excelSerialToIso, parseMaybeDate } from "@/utils/dates";
import React, { useState } from "react";

interface Props {
  apiUrl?: string; // base url that exposes the /export endpoint (no trailing slash)
  end?: string; // YYYY-MM-DD
  days?: number; // 1..15
  asXlsx?: boolean; // true -> convert to xlsx (default true)
  filename?: string;
  className?: string;
}

const money = (n: unknown) => {
  const value = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 2,
  }).format(value);
};

function formatDateISO(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ExportReport({
  apiUrl = "",
  end,
  days = 15,
  asXlsx = true,
  filename,
  className,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildUrl() {
    const base = apiUrl ? apiUrl.replace(/\/*$/, "") : "";
    const u = base ? `${base}/export` : "/export";
    const url = new URL(u, window.location.origin);
    if (end) url.searchParams.set("end", end);
    if (days) url.searchParams.set("days", String(days));
    return url.toString();
  }

  async function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // safe parse for JSON-string columns
  function parseArray(str: any) {
    if (!str && str !== 0) return [];
    if (Array.isArray(str)) return str;
    if (typeof str === "object") return [str];
    try {
      const s = String(str).trim();
      if (s === "" || s === "[]") return [];
      return JSON.parse(s);
    } catch {
      return [];
    }
  }

  const handleExport = async () => {
    setError(null);
    setLoading(true);
    try {
      const url = buildUrl();
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "text/csv" },
      });

      console.log(res)
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const csvText = await res.text();
      console.log(csvText)
      const outName = filename || (() => {
        const endISO = end || formatDateISO(new Date());
        const mid = new Date(`${endISO}T12:00:00-05:00`);
        mid.setDate(mid.getDate() - (days - 1));
        const startISO = formatDateISO(mid);
        return asXlsx ? `export_${startISO}_to_${endISO}.xlsx` : `export_${startISO}_to_${endISO}.csv`;
      })();

      if (!asXlsx) {
        const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
        await downloadBlob(blob, outName);
        setLoading(false);
        return;
      }

      const XLSXModule = await import("xlsx");
      const XLSX = XLSXModule.default || XLSXModule;

      // clean BOM
      const cleaned = csvText.replace(/^\uFEFF/, "");

      // parse CSV -> worksheet -> json rows
      const workbookTmp = XLSX.read(cleaned, { type: "string" });
      const tmpSheet = workbookTmp.Sheets[workbookTmp.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(tmpSheet, { defval: "" });

      // We'll build a workbook where each CSV row becomes a vertical report (own sheet).
      const workbook = XLSX.utils.book_new();

      jsonData.forEach((row: any, idx: number) => {
        const aoa: any[][] = []; // array of rows (each row is an array of cells)
        const merges: any[] = []; // merges for titles/sections

        function pushTitle(text: string) {
          const r = aoa.length;
          aoa.push([text, ""]);
          merges.push({ s: { r, c: 0 }, e: { r, c: 1 } });
        }

        function pushBlank() {
          aoa.push(["", ""]);
        }

        const da_te = excelSerialToIso(row.DATE)
        pushTitle(da_te);
        pushBlank();

        pushTitle("VENTAS");
        pushBlank();

        const sales = parseArray(row.SALES);
        if (sales.length === 0) {
          aoa.push(["(sin ventas)", ""]);
        } else {
          sales.forEach((sale: any, sidx: number) => {
            // Each sale as a block
            // "VENTA" header for the block
            pushTitle("VENTA");
            // then key-value pairs
            aoa.push(["PRODUCTO", sale.productCode ?? ""]);
            aoa.push(["TALLA", sale.size ?? sale.talla ?? ""]);
            aoa.push(["TIENDA", sale.storeId ?? sale.store ?? ""]);
            aoa.push(["CANTIDAD", typeof sale.quantity === "number" ? sale.quantity : (sale.quantity ?? "")]);
            aoa.push(["PRECIO DE VENTA ORIGINAL", money(sale.originalSellPrice/100)]);
            aoa.push(["PRECIO DE COSTO", money(sale.costPrice/100)]);
            aoa.push(["PRECIO DE VENTA APLICADO", money(sale.appliedSellPrice/100)]);
            aoa.push(["SUBGANANCIA", money(sale.subGain/100)]);
            pushBlank();
          });
        }

        pushTitle("GASTOS");
        pushBlank();

        const expenses = parseArray(row.EXPENSES);
        if (expenses.length === 0) {
          aoa.push(["(sin gastos)", ""]);
        } else {
          expenses.forEach((exp: any) => {
            aoa.push(["GASTO", exp.name ?? ""]);
            aoa.push(["COSTO", typeof exp.costDaily === "number" ? money(exp.costDaily/100) : (money(exp.costDaily/100) ?? "")]);
            pushBlank();
          });
        }

        // pushTitle("TIENDAS");
        // pushBlank();

        // const storeKeys = Object.keys(row).filter(k => /^store[_-]\d+$/i.test(k) || /^store\d+$/i.test(k));
        // if (storeKeys.length === 0) {
        //   aoa.push(["(no hay totales por tienda)", ""]);
        //   pushBlank();
        // } else {
        //   storeKeys.forEach(k => {
        //     const match = k.match(/\d+/);
        //     const storeId = match ? match[0] : k;
        //     const val = row[k];
        //     aoa.push([`Tienda ${storeId}:`, typeof val === "number" ? val : (val ?? "")]);
        //   });
        //   pushBlank();
        // }

        // Totals
        pushTitle("RESUMEN");
        aoa.push([
          "Total en Ventas", 
          typeof row.TOTAL_SALES === "number" ? money(row.TOTAL_SALES/100) : (money(row.TOTAL_SALES/100) ?? "")]);
        aoa.push([
          "Total en Gastos", 
          typeof row.TOTAL_EXPENSES === "number" ? money(row.TOTAL_EXPENSES/100) : (money(row.TOTAL_EXPENSES/100) ?? "")]);
        const ts = toNumber(row.TOTAL_SALES)/100;
        const te = toNumber(row.TOTAL_EXPENSES)/100;
        const util = !isNaN(ts) && !isNaN(te) ? ts - te : "";
        aoa.push(["Utilidades", money(util)]);
        aoa.push(["", ""]);

        // Create worksheet from aoa
        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // apply merges
        ws["!merges"] = merges;

        // set some column widths to look nicer (optional)
        ws["!cols"] = [{ wch: 30 }, { wch: 30 }];

        // Add sheet named by date (sanitize)
        const safeName = String(row.DATE || `Sheet ${idx + 1}`).slice(0, 31);
        XLSX.utils.book_append_sheet(workbook, ws, safeName);
      });

      // write file
      XLSX.writeFile(workbook, outName);
    } catch (err: any) {
      console.error("Export error:", err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  // small helpers
  function toNumber(v: any) {
    if (typeof v === "number") return v;
    const n = Number(String(v).replace(/[^\d.-]/g, ""));
    return isNaN(n) ? NaN : n;
  }
  function moneyOrEmpty(v: any) {
    if (v === null || v === undefined || v === "") return "";
    const n = toNumber(v);
    return isNaN(n) ? String(v) : n;
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #ccc",
          background: loading ? "#f3f4f6" : "white",
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "Generando..." : asXlsx ? "Exportar XLSX" : "Exportar CSV"}
      </button>
      {error ? (
        <div style={{ color: "#b91c1c", marginTop: 8, fontSize: 13 }}>{error}</div>
      ) : null}
    </div>
  );
}
