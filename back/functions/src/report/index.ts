import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v1/https';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin.apps.length) admin.initializeApp();
const db = getFirestore();

const ORIGIN = process.env.WEB_URL || 'http://localhost:3000';

const app = express();
app.use(
  cors({
    origin: ORIGIN,
  })
);
app.use(express.json());

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

function escapeCSV(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function jsonForCSV(obj: unknown): string {
  const s = JSON.stringify(obj ?? []);
  return `"${s.replace(/"/g, '""')}"`; 
}
const DAYS_MAX = 15;
const WINDOW_DAYS = 30;

function limaDayBounds(dateISO: string): { startUTC: Date; endUTC: Date } {
  const start = new Date(`${dateISO}T00:00:00-05:00`);
  const end = new Date(`${dateISO}T23:59:59.999-05:00`);
  return { startUTC: start, endUTC: end };
}

app.get('/export', async (req, res) => {
  try {
    // Params: supporta ?end=YYYY-MM-DD&days=1..15  (si no envías end, usa hoy Lima)
    const endParam = (req.query.end as string) || getTodayISO();
    const daysParam = parseInt((req.query.days as string) || '15', 10);

    if (Number.isNaN(daysParam) || daysParam < 1 || daysParam > DAYS_MAX) {
      return res.status(400).json({ error: `days debe estar entre 1 y ${DAYS_MAX}` });
    }
    // validar ventana de 30 días hacia atrás
    const todayISO = getTodayISO();
    const today = new Date(`${todayISO}T12:00:00-05:00`);
    const endCheck = new Date(`${endParam}T12:00:00-05:00`);
    const earliest = new Date(today);
    earliest.setDate(today.getDate() - WINDOW_DAYS);
    if (endCheck < earliest || endCheck > today) {
      return res.status(400).json({ error: `end debe estar dentro de los últimos ${WINDOW_DAYS} días` });
    }

    const fromDate = new Date(`${endParam}T12:00:00-05:00`);
    fromDate.setDate(fromDate.getDate() - (daysParam - 1));
    const days: string[] = [];
    const cursor = new Date(fromDate);
    while (cursor <= endCheck) {
      const yyyy = cursor.getUTCFullYear();
      const mm = String(cursor.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(cursor.getUTCDate()).padStart(2, '0');
      days.push(`${yyyy}-${mm}-${dd}`);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const reportSnaps = await Promise.all(
      days.map(d => db.collection('dailyReports').doc(d).get())
    );
    const reports = reportSnaps
      .filter(s => s.exists)
      .map(s => ({ id: s.id, data: s.data() as any }));

    if (!reports.length) {
      const headers = ['DATE','SALES_COUNT','SALES','PRODUCTS','EXPENSES','TOTAL_SALES','TOTAL_EXPENSES','UTILITIES'];
      res.setHeader('Content-Type', 'text/csv; charset=UTF-8');
      res.setHeader('Content-Disposition', `attachment; filename="export_${days[0]}_to_${days[days.length-1]}.csv"`);
      return res.status(200).send('\uFEFF' + headers.join(',') + '\n');
    }

    const storeIdSet = new Set<number>();
    for (const r of reports) {
      const ids: number[] = r.data?.meta?.storeIds || [];
      ids.forEach(id => storeIdSet.add(id));
    }
    const storeIds = Array.from(storeIdSet).sort((a,b) => a - b);

    const headers = [
      'DATE',
      'SALES_COUNT',
      'SALES',        // JSON array de ventas del día
      'PRODUCTS',     // JSON array de productos involucrados
      'EXPENSES',     // JSON array de otherExpenses
      'TOTAL_SALES',
      'TOTAL_EXPENSES',
      'UTILITIES',
      ...storeIds.map(id => `store_${id}`)
    ];

    // 4) Armar filas
    const rows: string[] = [];
    for (const r of reports) {
      const dateISO = r.id;
      const rep = r.data;

      // 4.1 ventas del día
      const { startUTC, endUTC } = limaDayBounds(dateISO);
      const salesSnap = await db
        .collection('sales')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startUTC))
        .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endUTC))
        .get();

      const sales = salesSnap.docs.map(d => d.data()) as any[];
      const salesCount = sales.length;

      // 4.2 productos involucrados (por productCode). Volumen pequeño => consultas por código.
      const codes = Array.from(new Set<string>(sales.map(s => s.productCode).filter(Boolean)));
      const productsDetails: any[] = [];
      for (const code of codes) {
        const pq = await db.collection('products').where('code', '==', code).limit(1).get();
        if (!pq.empty) {
          const p = pq.docs[0].data() as any;
          productsDetails.push({
            code,
            name: p.name ?? undefined,
            sellPrice: p.sellPrice ?? undefined,
            costPrice: p.costPrice ?? undefined,
          });
        } else {
          // si no existe el producto, al menos dejamos el código
          productsDetails.push({ code });
        }
      }

      // 4.3 otherExpenses referenciados en meta.otherExpenseIds
      const expenseIds: string[] = rep?.meta?.otherExpenseIds || [];
      let expensesDetails: any[] = [];
      if (expenseIds.length) {
        const refs = expenseIds.map(id => db.collection('otherExpenses').doc(id));
        const expenseDocs = await db.getAll(...refs);
        expensesDetails = expenseDocs
          .filter(d => d.exists)
          .map(d => {
            const e = d.data() as any;
            return { name: e.name, costDaily: e.costDaily };
          });
      }

      // 4.4 storeTotals ordenados por storeIds globales
      const perStore = storeIds.map(id => {
        const v = rep?.storeTotals?.[String(id)] ?? rep?.storeTotals?.[id] ?? 0;
        return v;
      });

      // 4.5 construir fila
      const salesSlim = sales.map(s => ({
        productCode: s.productCode,
        storeId: s.storeId,
        quantity: s.quantity,
        subGain: s.subGain,
      }));

      const line = [
        escapeCSV(dateISO),
        String(salesCount),
        jsonForCSV(salesSlim),
        jsonForCSV(productsDetails),
        jsonForCSV(expensesDetails),
        String(rep?.totalSales ?? 0),
        String(rep?.totalExpenses ?? 0),
        String(rep?.utilities ?? 0),
        ...perStore.map(v => String(v))
      ].join(',');

      rows.push(line);
    }

    // 5) Emitir CSV
    const filename = `export_${reports[0].id}_to_${reports[reports.length - 1].id}.csv`;
    const csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=UTF-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);

  } catch (err: any) {
    console.error('Error en /exportCsv:', err);
    return res.status(500).json({ error: err?.message ?? 'Internal error' });
  }
});


export const report = onRequest(app); 
