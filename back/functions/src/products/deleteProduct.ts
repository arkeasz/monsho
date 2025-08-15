import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v1/https';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const dbPD = admin.firestore();

const app = express();
app.use(express.json());

const ORIGIN = process.env.WEB_URL || 'http://localhost:3000'

app.use(
  cors({
    origin: ORIGIN
  })
);

app.use(express.json());

app.delete('/', async (req, res) => {
  try {
    const { id } = req.body as { id?: string };
    if (!id) {
      return res.status(400).json({ error: 'El campo id es obligatorio' });
    }

    const docRef = dbPD.collection('products').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    await docRef.delete();
    return res.json({ message: 'Producto eliminado correctamente' });
  } catch (error: any) {
    console.error('deleteProduct error:', error);
    if (error && error.message && error.message.includes('CORS')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Error interno' });
  }
});

export const deleteProduct = onRequest(app);
