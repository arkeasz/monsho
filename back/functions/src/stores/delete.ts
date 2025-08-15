import db from "./db";

export const delete_store = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    await db.collection('stores').doc(id).delete();
    return res.json({ message: `Tienda ${id} eliminada.` });
  } catch (err: any) {
    console.error(`Error eliminando store ${req.params.id}:`, err);
    return res.status(500).json({ error: err.message });
  }
}