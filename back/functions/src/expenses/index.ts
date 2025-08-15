import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v1/https';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const ORIGIN = process.env.WEB_URL || 'http://localhost:3000';

const app = express();
app.use(cors({ origin: ORIGIN }));
app.use(express.json());
app.post('/', async (req, res) => {
  try {
    const { name, costDaily, dateISO } = req.body;
    if (!name || !dateISO || !Number.isFinite(costDaily)) {
      return res.status(400).json({ error: 'Missing or invalid fields' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return res.status(400).json({ error: 'dateISO must be YYYY-MM-DD' });
    }

    const newExpenseRef = db.collection('otherExpenses').doc();
    const dailyReportRef = db.collection('dailyReports').doc(dateISO);
      const { FieldValue } = await import('firebase-admin/firestore');


    await db.runTransaction(async (tx) => {
      // 1) lecturas primero
      const dailySnap = await tx.get(dailyReportRef);

      // 2) crear expense
      tx.set(newExpenseRef, {
        name,
        costDaily,
        dateISO,
        createdAt: FieldValue.serverTimestamp(),
      });

      // 3) construir reportData SIN keys undefined
      const reportData: any = {
        date: dateISO,
        totalExpenses: FieldValue.increment(costDaily),
        meta: {
          otherExpenseIds: FieldValue.arrayUnion(newExpenseRef.id),
        },
      };

      // Si no existía el daily report, añadimos campos para creación
      if (!dailySnap.exists) {
        reportData.storeTotals = {};            // sólo aquí lo añadimos
        reportData.createdAt = FieldValue.serverTimestamp();
      }

      // 4) set merge (una sola escritura para actualizar/crear)
      tx.set(dailyReportRef, reportData, { merge: true });
    });

    return res.status(201).json({ id: newExpenseRef.id });
  } catch (error) {
    console.error('create expense error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// PUT - Actualizar gasto y ajustar totalExpenses
app.put('/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;
    const { name, costDaily, dateISO } = req.body;
    if (!dateISO) {
      return res.status(400).json({ error: 'dateISO is required' });
    }
    if (name === undefined && costDaily === undefined) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const expenseRef = db.collection('otherExpenses').doc(expenseId);
    const dailyReportRef = db.collection('dailyReports').doc(dateISO);

    await db.runTransaction(async (tx) => {
      const expenseSnap = await tx.get(expenseRef);
      if (!expenseSnap.exists) {
        throw new Error('Expense not found');
      }
      const oldData = expenseSnap.data() || {};
      const { FieldValue } = await import('firebase-admin/firestore');

      // Actualiza el gasto con los nuevos datos
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (costDaily !== undefined) updates.costDaily = costDaily;
      tx.update(expenseRef, updates);

      // Ajusta totalExpenses si cambió costDaily
      if (typeof costDaily === 'number') {
        const oldCost = oldData.costDaily ?? 0;
        const delta = costDaily - oldCost;
        if (delta !== 0) {
          tx.update(dailyReportRef, {
            totalExpenses: FieldValue.increment(delta),
          });
        }
      }
    });

    return res.status(200).json({ message: 'Expense updated' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
});

// DELETE - Borrar gasto y actualizar dailyReport
app.delete('/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;
    const { dateISO } = req.body; // debe enviarse la fecha para saber qué dailyReport actualizar
    if (!dateISO) {
      return res.status(400).json({ error: 'dateISO is required' });
    }

    const expenseRef = db.collection('otherExpenses').doc(expenseId);
    const dailyReportRef = db.collection('dailyReports').doc(dateISO);

    await db.runTransaction(async (tx) => {
      const expenseSnap = await tx.get(expenseRef);
      if (!expenseSnap.exists) {
        res.status(404).json({ error: 'Expense not found' });
        return;
      }
      const { costDaily } = expenseSnap.data() || {};
      const { FieldValue } = await import('firebase-admin/firestore');

      tx.delete(expenseRef);

      tx.update(dailyReportRef, {
        'meta.otherExpenseIds': FieldValue.arrayRemove(expenseId),
        totalExpenses: FieldValue.increment(-costDaily || 0),
      });
    });

    return res.status(200).json({ message: 'Expense deleted' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
});

app.get('/', async (req: any, res: any) => {
  try {
    const dateISO = req.query.dateISO as string;
    if (!dateISO) {
      return res.status(400).json({ error: 'dateISO query param required' });
    }

    const dailyReportRef = db.collection('dailyReports').doc(dateISO);
    const dailySnap = await dailyReportRef.get();

    if (!dailySnap.exists) {
      return res.status(404).json({ error: 'Daily report not found' });
    }

    const dailyData = dailySnap.data();
    const expenseIds: string[] = dailyData?.meta?.otherExpenseIds || [];

    if (expenseIds.length === 0) {
      return res.json([]);
    }

    const expenseRefs = expenseIds.map(id => db.collection('otherExpenses').doc(id));
    const expenseSnaps = await db.getAll(...expenseRefs);

    const expenses = expenseSnaps
      .filter(doc => doc.exists)
      .map(doc => ({ id: doc.id, ...(doc.data() as any) }));

    res.json(expenses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export const expenses = onRequest(app);
