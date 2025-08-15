import db from './db';

export const get_stores = async (_req: any, res: any) => {
  try {
    const snap = await db.collection('stores').get();
    const stores = snap.docs.map(doc => ({
      id:        doc.id,
      ...doc.data()
    }));
    return res.json(stores);
  } catch (err: any) {
    console.error('Error listando stores:', err);
    return res.status(500).json({ error: err.message });
  }
}

export const get_store = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const docRef = db.collection('stores').doc(id);
    const snap   = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Tienda no encontrada.' });
    }
    return res.json({ id: snap.id, ...snap.data() });
  } catch (err: any) {
    console.error(`Error obteniendo store ${req.params.id}:`, err);
    return res.status(500).json({ error: err.message });
  }
}
