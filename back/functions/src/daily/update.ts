import { FieldValue } from "firebase-admin/firestore";
import { Request, Response } from 'express';
import db from './db';
import { validateDateString } from './validators';

const allowedKeys = ['storeTotals', 'totalSales', 'totalExpenses', 'utilities', 'meta', 'date'];

export default async function putReport(req: Request, res: Response) {
  const date = req.params.date as string;
  if (!validateDateString(date)) return res.status(400).json({ error: 'date debe ser YYYY-MM-DD' });

  const payload = req.body ?? {};
  const updateData: Record<string, any> = {};

  for (const k of Object.keys(payload)) {
    if (!allowedKeys.includes(k)) continue;
    updateData[k] = payload[k];
  }

  updateData.date = date;
  updateData.updatedAt = FieldValue.serverTimestamp();


  const docRef = db.collection('dailyReports').doc(date);
  await docRef.set(updateData, { merge: true });

  const snap = await docRef.get();
  return res.json({ id: snap.id, ...snap.data() });
}
