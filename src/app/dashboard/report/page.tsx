"use client";
import React from "react";
import styles from "@styles/sells.module.css";
import OtherExpensesTable from "@/components/OtherExpenses";
import DailyReport from "@/components/DailyReport";

export default function Home() {
  return (
    <div className={styles.container}>
      <OtherExpensesTable />
      <DailyReport />
    </div>
  );
}