import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v1/https';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const dbPU = admin.firestore();

interface UpdateProductRequest {
  id: string;
  brand?: string;
  code?: string;
  color?: string;
  costPrice?: number;
  sellPrice?: number;
  sizes?: { size: string; quantity: number }[] | null; // null -> borrar/reemplazar?
  imageUrl?: string | null; 
}

const app = express();
app.use(express.json());

const ORIGIN = process.env.WEB_URL || 'http://localhost:3000';
app.use(cors({ origin: ORIGIN }));
app.use(express.json());

app.put('/', async (req, res) => {
  try {
    const body = req.body as UpdateProductRequest;
    const id = String(body.id ?? '').trim();
    if (!id) return res.status(400).json({ error: 'id es obligatorio' });

    const docRef = dbPU.collection('products').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'Producto no encontrado' });

    const updates: any = {};

    if (body.brand !== undefined) {
      const brand = String(body.brand ?? '').trim().slice(0, 100);
      updates.brand = brand;
    }

    if (body.code !== undefined) {
      const code = String(body.code ?? '').trim().slice(0, 100);
      if (!code) return res.status(400).json({ error: 'code no puede estar vacío' });

      const q = await dbPU.collection('products').where('code', '==', code).limit(1).get();
      const conflict = q.docs.find(d => d.id !== id);
      if (conflict) return res.status(409).json({ error: 'El código ya está en uso por otro producto' });

      updates.code = code;
    }

    if (body.color !== undefined) {
      const color = String(body.color ?? '').trim().slice(0, 50);
      if (!color) return res.status(400).json({ error: 'color no puede estar vacío' });
      updates.color = color;
    }

    if (body.costPrice !== undefined) {
      const costPrice = Math.round(Number(body.costPrice) * 100);
      if (!Number.isFinite(costPrice) || costPrice < 0) return res.status(400).json({ error: 'costPrice inválido' });
      updates.costPrice = costPrice;
    }

    if (body.sellPrice !== undefined) {
      const sellPrice = Math.round(Number(body.sellPrice) * 100);
      if (!Number.isFinite(sellPrice) || sellPrice < 0) return res.status(400).json({ error: 'sellPrice inválido' });
      updates.sellPrice = sellPrice;
    }

    if (body.sizes !== undefined) {
      if (body.sizes === null) {
        updates.sizes = [];
      } else {
        if (!Array.isArray(body.sizes) || body.sizes.length === 0) {
          return res.status(400).json({ error: 'Al menos una talla es obligatoria si se envía sizes' });
        }
        if (body.sizes.length > 200) return res.status(400).json({ error: 'Demasiadas tallas' });

        const sizesClean: { size: string; quantity: number }[] = [];
        for (const s of body.sizes) {
          if (!s || typeof s !== 'object') return res.status(400).json({ error: 'Formato inválido en tallas' });
          const size = String((s as any).size ?? '').trim();
          const quantity = Number((s as any).quantity);
          if (!size) return res.status(400).json({ error: 'Cada talla requiere un nombre' });
          if (!Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ error: 'Cantidad inválida en tallas' });
          sizesClean.push({ size, quantity });
        }
        updates.sizes = sizesClean;
      }
    }

    if (body.imageUrl !== undefined) {
      if (body.imageUrl === null) {
        updates.imageUrl = null;
      } else {
        const imageUrl = String(body.imageUrl ?? '').trim();
        const keyRegex = /^images\/[A-Za-z0-9\-_.]+?\.[a-z0-9]{1,6}$/i;
        if (!keyRegex.test(imageUrl)) {
          return res.status(400).json({ error: 'imageUrl (key) inválida. Debe ser images/<hash>-<ts>.<ext>' });
        }
        if (imageUrl.length > 460) return res.status(400).json({ error: 'imageUrl demasiado larga' });
        updates.imageUrl = imageUrl;
      }
    }

    const keys = Object.keys(updates);
    if (keys.length === 0) {
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    const { FieldValue } = await import('firebase-admin/firestore');
    updates.updatedAt = FieldValue.serverTimestamp();

    await docRef.update(updates);

    return res.json({ message: 'Producto actualizado', id });
  } catch (error: any) {
    console.error('updateProduct error:', error);
    if (error && error.message && error.message.includes('CORS')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Error interno' });
  }
});

export const updateProduct = onRequest(app);
