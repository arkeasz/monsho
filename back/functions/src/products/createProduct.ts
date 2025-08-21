import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v1/https';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const dbP = admin.firestore();

interface SizeInfo {
  size: string;
  quantity: number;
}

interface ProductItem {
  brand?: string;
  code: string;
  color: string;
  costPrice: number;
  description: string;
  sellPrice: number;
  sizes: SizeInfo[];
  imageUrl?: string;
}

const app = express();

const ORIGIN = process.env.WEB_URL || 'http://localhost:3000'

app.use(
  cors({
    origin: ORIGIN
  })
);

app.use(express.json());
app.post('/', async (req, res) => {
  try {
    let {
      brand = '',
      code,
      color,
      costPrice,
      description,
      sellPrice,
      sizes,
      imageUrl
    } = req.body as ProductItem;

    if (
      !code ||
      !color ||
      costPrice == null ||
      !description ||
      sellPrice == null ||
      !Array.isArray(sizes) ||
      sizes.length === 0
    ) {
      return res.status(400).json({ error: 'Todos los campos y tallas son obligatorios' });
    }
    if (code.includes('/')) {
      return res.status(400).json({ error: 'El campo code no puede contener "/"' });
    }

    for (const s of sizes) {
      if (
        typeof s.size !== 'string' ||
        s.size.trim() === '' ||
        typeof s.quantity !== 'number' ||
        s.quantity < 0
      ) {
        return res.status(400).json({ error: 'Formato inválido en tallas o cantidades' });
      }
    }

    
    if (imageUrl) {
      const keyRegex = /^images\/[A-Za-z0-9\-_.]+?\.[a-z0-9]{1,6}$/i;
      if (!keyRegex.test(imageUrl)) {
        return res.status(400).json({ error: 'imageUrl (key) inválida. Debe ser algo como images/<hash>-<ts>.<ext>' });
      }
      if (imageUrl.length > 460) return res.status(400).json({ error: 'imageUrl demasiado larga' });
    }
    const existingQ = await dbP.collection('products').where('code', '==', code).limit(1).get();
    if (!existingQ.empty) {
      return res.status(409).json({ error: 'El código ya está en uso' });
    }

    const { FieldValue } = await import('firebase-admin/firestore');
    costPrice = Math.round(costPrice*100)
    sellPrice =  Math.round(sellPrice*100)
    const ref = dbP.collection('products').doc();

    await ref.set({
      brand,
      code,
      color,
      costPrice,
      description,
      sellPrice,
      sizes,
      imageUrl: imageUrl ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });


    return res.status(201).json({ id: ref.id });
  } catch (error: any) {
    console.error('createProduct error:', error);
    if (error && error.message && error.message.includes('CORS')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Error interno' });
  }
});

export const createProduct = onRequest(app);
