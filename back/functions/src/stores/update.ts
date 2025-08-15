import { FieldValue } from "firebase-admin/firestore";
import db from "./db";

export const update_store = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body } as any;
    if (updates.rentMonthly != null) {
      updates.rentDaily = Number((updates.rentMonthly / 30).toFixed(2));
    }
    updates.updatedAt = FieldValue.serverTimestamp();

    await db.collection('stores').doc(id).update(updates);
    const updatedSnap = await db.collection('stores').doc(id).get();
    return res.json({ id, ...updatedSnap.data() });
  } catch (err: any) {
    console.error(`Error actualizando store ${req.params.id}:`, err);
    return res.status(500).json({ error: err.message });
  }
}