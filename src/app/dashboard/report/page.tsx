"use client";
import React, { useState } from "react";
import styles from "@styles/sells.module.css";
import OtherExpensesTable from "@/components/OtherExpenses";
import DailyReport from "@/components/DailyReport";
import ExportReport from "@/components/ExportReport";

function getTodayISO(): string {
  try {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });
  } catch {
    const now = new Date();
    const lima = new Date(now.getTime() + (-5 - now.getTimezoneOffset() / 60) * 3600 * 1000);
    const yyyy = lima.getUTCFullYear();
    const mm = String(lima.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(lima.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}

export default function Home() {
  const today = getTodayISO();
  const [end, setEnd] = useState<string>(today);
  const [days, setDays] = useState<number>(7);

  return (
    <div className={styles.container}>
      <div>
        <label>
          <span>Fecha final</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label>
          <span >Días</span>
            <input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 1)}
            />
        </label>
      </div>
      <ExportReport 
        apiUrl={`${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/report`} 
        end={end}
        days={days} 
        asXlsx
      />
      <OtherExpensesTable />
      <DailyReport />
    </div>
  );
}