import { Request, Response } from 'express';
import db from './db';
import { nextMonthStart, validateMonthString } from './validators';

export default async function getReports(req: Request, res: Response) {
  const { month, limit = '50', pageToken } = req.query as Record<string, string | undefined>;
  let q: FirebaseFirestore.Query = db.collection('dailyReports').orderBy('date', 'desc');
  const lim = Math.max(1, Math.min(200, Number(limit || 50)));

  if (month) {
    if (!validateMonthString(month)) {
      return res.status(400).json({ error: 'month debe ser YYYY-MM' });
    }
    const start = `${month}-01`;
    const end = nextMonthStart(month);
    q = db.collection('dailyReports')
           .where('date', '>=', start)
           .where('date', '<', end)
           .orderBy('date', 'desc');
  }

  if (pageToken) {
    q = q.startAfter(pageToken);
  }

  q = q.limit(lim);

  const snap = await q.get();
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const nextPageToken = items.length ? (items[items.length - 1] as any).date : null;

  return res.json({ count: items.length, nextPageToken, items });
}
