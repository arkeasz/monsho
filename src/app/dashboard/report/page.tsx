"use client";
import React from "react";
import styles from "@styles/sells.module.css";
import OtherExpensesTable from "@/components/OtherExpenses";
import DailyReport from "@/components/DailyReport";
import ExportReport from "@/components/ExportReport";

export default function Home() {
  return (
    <div className={styles.container}>
      <ExportReport/>
      <OtherExpensesTable />
      <DailyReport />
    </div>
  );
}