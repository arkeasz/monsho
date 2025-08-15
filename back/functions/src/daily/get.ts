import { Request, Response } from 'express';
import db from './db';
import { validateDateString } from './validators';

export default async function getReport(req: Request, res: Response) {
  const date = req.params.date as string;
  if (!validateDateString(date)) return res.status(400).json({ error: 'date debe ser YYYY-MM-DD' });

  const docRef = db.collection('dailyReports').doc(date);
  const snap = await docRef.get();
  if (!snap.exists) return res.status(404).json({ error: 'report no encontrado' });

  return res.json({ id: snap.id, ...snap.data() });
}
