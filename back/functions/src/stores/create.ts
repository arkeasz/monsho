import { FieldValue } from "firebase-admin/firestore";
import db from "./db";


export const create_store = async (req: any, res: any) => {
  try {
    const { id, rentMonthly, ...rest } = req.body as {
      id?: string;
      rentMonthly: number;
      [key: string]: any;
    };
    if (rentMonthly == null) {
      return res.status(400).json({ error: 'rentMonthly es obligatorio.' });
    }
    const docId = id?.toString() || db.collection('stores').doc().id;
    const rentDaily = Number((rentMonthly / 30).toFixed(2)); // o tu divisor

    await db.collection('stores').doc(docId).set({
      rentMonthly,
      rentDaily,
      ...rest,
      updatedAt: FieldValue.serverTimestamp()
    });

    return res.status(201).json({ id: docId, rentMonthly, rentDaily, ...rest });
  } catch (err: any) {
    console.error('Error creando store:', err);
    return res.status(500).json({ error: err.message });
  }
}