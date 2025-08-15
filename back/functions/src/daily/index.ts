import express from 'express';
import cors from 'cors';
import getReports from './get_all';
import getReport from './get';
import putReport from './update';
import { onRequest } from 'firebase-functions/v1/https';

const ORIGIN = process.env.WEB_URL || 'http://localhost:3000';

const app = express();
app.use(cors({ origin: ORIGIN }));
app.use(express.json());

const wrap = (fn: express.Handler) => (req: express.Request, res: express.Response, next: express.NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get('/reports', wrap(getReports));
app.get('/reports/:date', wrap(getReport));
app.put('/reports/:date', wrap(putReport));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API error:', err);
  if (err && err.code === 'NOT_FOUND') return res.status(404).json({ error: 'not_found' });
  return res.status(500).json({ error: 'internal_error', message: err?.message || String(err) });
});

export const daily = onRequest(app);
